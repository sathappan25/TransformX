const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID, randomBytes } = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "transformx-dev-secret-change-this";
const DATA_FILE = path.join(__dirname, "server-data.json");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "1mb" }));

let writeQueue = Promise.resolve();

async function ensureStorageFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (_error) {
    const initialState = {
      users: [],
      scenes: []
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(initialState, null, 2), "utf8");
  }
}

async function readStorage() {
  await ensureStorageFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");

  if (!Array.isArray(parsed.users)) {
    parsed.users = [];
  }

  if (!Array.isArray(parsed.scenes)) {
    parsed.scenes = [];
  }

  return parsed;
}

async function writeStorage(nextState) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DATA_FILE, JSON.stringify(nextState, null, 2), "utf8")
  );

  return writeQueue;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt
  };
}

function sceneSummary(scene) {
  return {
    id: scene.id,
    name: scene.name,
    createdAt: scene.createdAt,
    updatedAt: scene.updatedAt,
    shareId: scene.shareId
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function extractBearerToken(headerValue) {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function authRequired(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization token." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    next();
  } catch (_error) {
    res.status(401).json({ error: "Session is invalid or expired." });
  }
}

function validateSceneData(sceneData) {
  return sceneData && typeof sceneData === "object" && !Array.isArray(sceneData);
}

function generateSceneName(storage, ownerId) {
  const ownedCount = storage.scenes.filter((scene) => scene.ownerId === ownerId).length;
  return `Scene ${ownedCount + 1}`;
}

function makeShareId() {
  return randomBytes(8).toString("hex");
}

async function getAuthenticatedUser(req) {
  const storage = await readStorage();
  const user = storage.users.find((entry) => entry.id === req.auth.sub) || null;
  return { storage, user };
}

app.post("/api/auth/signup", async (req, res) => {
  const displayName = String(req.body.displayName || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const storage = await readStorage();
  const existing = storage.users.find((entry) => entry.email === email);

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const user = {
    id: randomUUID(),
    email,
    displayName,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  storage.users.push(user);
  await writeStorage(storage);

  res.status(201).json({
    token: signToken(user),
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const storage = await readStorage();
  const user = storage.users.find((entry) => entry.email === email);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  res.json({
    token: signToken(user),
    user: sanitizeUser(user)
  });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const { user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  res.json({ user: sanitizeUser(user) });
});

app.get("/api/scenes", authRequired, async (req, res) => {
  const { storage, user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  const scenes = storage.scenes
    .filter((scene) => scene.ownerId === user.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(sceneSummary);

  res.json({ scenes });
});

app.post("/api/scenes", authRequired, async (req, res) => {
  const { storage, user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  const providedName = String(req.body.name || "").trim();
  const sceneName = providedName || generateSceneName(storage, user.id);
  const sceneData = req.body.data;

  if (!validateSceneData(sceneData)) {
    res.status(400).json({ error: "Scene payload is invalid." });
    return;
  }

  const timestamp = new Date().toISOString();
  const scene = {
    id: randomUUID(),
    ownerId: user.id,
    name: sceneName,
    data: sceneData,
    shareId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  storage.scenes.push(scene);
  await writeStorage(storage);

  res.status(201).json({ scene: sceneSummary(scene) });
});

app.get("/api/scenes/:id", authRequired, async (req, res) => {
  const { storage, user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  const scene = storage.scenes.find(
    (entry) => entry.id === req.params.id && entry.ownerId === user.id
  );

  if (!scene) {
    res.status(404).json({ error: "Scene not found." });
    return;
  }

  res.json({
    scene: {
      ...sceneSummary(scene),
      data: scene.data
    }
  });
});

app.put("/api/scenes/:id", authRequired, async (req, res) => {
  const { storage, user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  const scene = storage.scenes.find(
    (entry) => entry.id === req.params.id && entry.ownerId === user.id
  );

  if (!scene) {
    res.status(404).json({ error: "Scene not found." });
    return;
  }

  const providedName = String(req.body.name || "").trim();
  if (providedName) {
    scene.name = providedName;
  }

  if (req.body.data !== undefined) {
    if (!validateSceneData(req.body.data)) {
      res.status(400).json({ error: "Scene payload is invalid." });
      return;
    }

    scene.data = req.body.data;
  }

  scene.updatedAt = new Date().toISOString();

  await writeStorage(storage);

  res.json({
    scene: sceneSummary(scene)
  });
});

app.post("/api/scenes/:id/share", authRequired, async (req, res) => {
  const { storage, user } = await getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ error: "Session no longer exists." });
    return;
  }

  const scene = storage.scenes.find(
    (entry) => entry.id === req.params.id && entry.ownerId === user.id
  );

  if (!scene) {
    res.status(404).json({ error: "Scene not found." });
    return;
  }

  if (!scene.shareId) {
    scene.shareId = makeShareId();
  }

  scene.updatedAt = new Date().toISOString();

  await writeStorage(storage);

  const shareUrl = `${req.protocol}://${req.get("host")}/?scene=${scene.shareId}`;

  res.json({
    shareId: scene.shareId,
    shareUrl
  });
});

app.get("/api/share/:shareId", async (req, res) => {
  const storage = await readStorage();
  const scene = storage.scenes.find((entry) => entry.shareId === req.params.shareId);

  if (!scene) {
    res.status(404).json({ error: "Shared scene not found." });
    return;
  }

  res.json({
    scene: {
      ...sceneSummary(scene),
      data: scene.data
    }
  });
});

app.use(express.static(__dirname));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API route not found." });
    return;
  }

  res.sendFile(path.join(__dirname, "index.html"));
});

async function bootstrap() {
  await ensureStorageFile();

  app.listen(PORT, () => {
    console.log(`TransformX server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
