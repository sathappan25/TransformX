const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID, randomBytes } = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "server-data.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

let writeQueue = Promise.resolve();

async function ensureStorageFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (_error) {
    await fs.writeFile(DATA_FILE, JSON.stringify({ scenes: [] }, null, 2), "utf8");
  }
}

async function readStorage() {
  await ensureStorageFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");

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

function makeShareId() {
  return randomBytes(8).toString("hex");
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

function validateSceneData(sceneData) {
  return sceneData && typeof sceneData === "object" && !Array.isArray(sceneData);
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1048576) {
        reject(new Error("Payload too large."));
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_error) {
        reject(new Error("Invalid JSON payload."));
      }
    });

    req.on("error", reject);
  });
}

function extractPathParams(pattern, pathname) {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

async function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": content.length
    });
    res.end(content);
  } catch (_error) {
    return false;
  }

  return true;
}

async function handleCreateScene(req, res) {
  const body = await parseBody(req);
  const providedName = String(body.name || "").trim();
  const sceneName = providedName || "Untitled Scene";
  const sceneData = body.data;

  if (!validateSceneData(sceneData)) {
    sendJson(res, 400, { error: "Scene payload is invalid." });
    return;
  }

  const storage = await readStorage();
  const timestamp = new Date().toISOString();
  const scene = {
    id: randomUUID(),
    name: sceneName,
    data: sceneData,
    shareId: makeShareId(),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  storage.scenes.push(scene);
  await writeStorage(storage);

  sendJson(res, 201, { scene: { ...sceneSummary(scene), data: scene.data } });
}

async function handleGetScene(res, sceneId) {
  const storage = await readStorage();
  const scene = storage.scenes.find((entry) => entry.id === sceneId);

  if (!scene) {
    sendJson(res, 404, { error: "Scene not found." });
    return;
  }

  sendJson(res, 200, {
    scene: { ...sceneSummary(scene), data: scene.data }
  });
}

async function handleUpdateScene(req, res, sceneId) {
  const body = await parseBody(req);
  const storage = await readStorage();
  const scene = storage.scenes.find((entry) => entry.id === sceneId);

  if (!scene) {
    sendJson(res, 404, { error: "Scene not found." });
    return;
  }

  const providedName = String(body.name || "").trim();
  if (providedName) {
    scene.name = providedName;
  }

  if (body.data !== undefined) {
    if (!validateSceneData(body.data)) {
      sendJson(res, 400, { error: "Scene payload is invalid." });
      return;
    }

    scene.data = body.data;
  }

  scene.updatedAt = new Date().toISOString();
  await writeStorage(storage);

  sendJson(res, 200, { scene: sceneSummary(scene) });
}

async function handleGetSharedScene(res, shareId) {
  const storage = await readStorage();
  const scene = storage.scenes.find((entry) => entry.shareId === shareId);

  if (!scene) {
    sendJson(res, 404, { error: "Shared scene not found." });
    return;
  }

  sendJson(res, 200, {
    scene: { ...sceneSummary(scene), data: scene.data }
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    });
    res.end();
    return;
  }

  try {
    if (pathname === "/api/scenes" && req.method === "POST") {
      await handleCreateScene(req, res);
      return;
    }

    let params = extractPathParams("/api/scenes/:id", pathname);
    if (params) {
      if (req.method === "GET") {
        await handleGetScene(res, params.id);
        return;
      }

      if (req.method === "PUT") {
        await handleUpdateScene(req, res, params.id);
        return;
      }
    }

    params = extractPathParams("/api/share/:shareId", pathname);
    if (params && req.method === "GET") {
      await handleGetSharedScene(res, params.shareId);
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "API route not found." });
      return;
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(__dirname, safePath);

    const served = await serveStaticFile(res, filePath);
    if (served) {
      return;
    }

    const indexPath = path.join(__dirname, "index.html");
    await serveStaticFile(res, indexPath);
  } catch (error) {
    console.error("Request error:", error.message);
    sendJson(res, 500, { error: "Internal server error." });
  }
}

async function bootstrap() {
  await ensureStorageFile();

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`TransformX server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
