import { palette } from "./config.js";
import { clamp, normalizeAngle, toRadians } from "./math-utils.js";

const API_BASE = "/api";
const API_ORIGIN = window.location.protocol.startsWith("http")
  ? ""
  : "http://localhost:3000";


const canvas = document.getElementById("sceneCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  objectTemplate: document.getElementById("objectTemplate"),
  addObjectBtn: document.getElementById("addObjectBtn"),
  deleteObjectBtn: document.getElementById("deleteObjectBtn"),
  objectList: document.getElementById("objectList"),
  selectedObjectLabel: document.getElementById("selectedObjectLabel"),

  txRange: document.getElementById("txRange"),
  txInput: document.getElementById("txInput"),
  tyRange: document.getElementById("tyRange"),
  tyInput: document.getElementById("tyInput"),
  tzRange: document.getElementById("tzRange"),
  tzInput: document.getElementById("tzInput"),

  rxRange: document.getElementById("rxRange"),
  rxInput: document.getElementById("rxInput"),
  ryRange: document.getElementById("ryRange"),
  ryInput: document.getElementById("ryInput"),
  rzRange: document.getElementById("rzRange"),
  rzInput: document.getElementById("rzInput"),

  sxRange: document.getElementById("sxRange"),
  sxInput: document.getElementById("sxInput"),
  syRange: document.getElementById("syRange"),
  syInput: document.getElementById("syInput"),
  szRange: document.getElementById("szRange"),
  szInput: document.getElementById("szInput"),

  resetSelectedBtn: document.getElementById("resetSelectedBtn"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  matrixOutput: document.getElementById("matrixOutput"),

  sceneName: document.getElementById("sceneName"),
  saveSceneBtn: document.getElementById("saveSceneBtn"),
  shareLink: document.getElementById("shareLink"),
  copyShareBtn: document.getElementById("copyShareBtn"),
  cloudStatus: document.getElementById("cloudStatus")
};

const testButtons = Array.from(document.querySelectorAll(".test-grid .test"));

const state = {
  objects: [],
  nextId: 1,
  selectedId: null,
  cameraDistance: 620,
  cameraYaw: toRadians(-25),
  cameraPitch: toRadians(12),
  orbit: {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
  },
  activeSceneId: null
};

function setStatus(element, message, tone = "info") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("status-error", "status-success");

  if (tone === "error") {
    element.classList.add("status-error");
  }

  if (tone === "success") {
    element.classList.add("status-success");
  }
}

function getCanvasCenter() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(460, Math.floor(rect.width));
  const height = Math.max(420, Math.floor(rect.height));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function createCubeGeometry(size = 140) {
  const s = size / 2;

  return {
    vertices: [
      { x: -s, y: -s, z: -s },
      { x: s, y: -s, z: -s },
      { x: s, y: s, z: -s },
      { x: -s, y: s, z: -s },
      { x: -s, y: -s, z: s },
      { x: s, y: -s, z: s },
      { x: s, y: s, z: s },
      { x: -s, y: s, z: s }
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ]
  };
}

function createCuboidGeometry(width = 190, height = 120, depth = 90) {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;

  return {
    vertices: [
      { x: -hx, y: -hy, z: -hz },
      { x: hx, y: -hy, z: -hz },
      { x: hx, y: hy, z: -hz },
      { x: -hx, y: hy, z: -hz },
      { x: -hx, y: -hy, z: hz },
      { x: hx, y: -hy, z: hz },
      { x: hx, y: hy, z: hz },
      { x: -hx, y: hy, z: hz }
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ]
  };
}

function createConeGeometry(radius = 70, height = 170, segments = 18) {
  const vertices = [{ x: 0, y: height / 2, z: 0 }];
  const edges = [];

  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push({
      x: radius * Math.cos(theta),
      y: -height / 2,
      z: radius * Math.sin(theta)
    });
  }

  const centerIndex = vertices.length;
  vertices.push({ x: 0, y: -height / 2, z: 0 });

  for (let i = 0; i < segments; i += 1) {
    const rim = 1 + i;
    const next = 1 + ((i + 1) % segments);
    edges.push([0, rim]);
    edges.push([rim, next]);
    edges.push([centerIndex, rim]);
  }

  return {
    vertices,
    edges
  };
}

function buildTemplate(type) {
  if (type === "cuboid") {
    return {
      ...createCuboidGeometry(),
      label: "cuboid"
    };
  }

  if (type === "cone") {
    return {
      ...createConeGeometry(),
      label: "cone"
    };
  }

  return {
    ...createCubeGeometry(),
    label: "cube"
  };
}

function createObject(type, overrides = {}) {
  const template = buildTemplate(type);
  const index = state.objects.length;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const tx = -190 + column * 190;
  const ty = 0;
  const tz = row * 120;
  const typeIndex = state.objects.filter((entry) => entry.type === type).length + 1;

  const object3d = {
    id: state.nextId++,
    type,
    name: overrides.name || `${template.label}${typeIndex}`,
    vertices: template.vertices,
    edges: template.edges,
    color: overrides.color || palette[index % palette.length],
    tx: overrides.tx ?? tx,
    ty: overrides.ty ?? ty,
    tz: overrides.tz ?? tz,
    rx: overrides.rx ?? 0,
    ry: overrides.ry ?? 0,
    rz: overrides.rz ?? 0,
    sx: overrides.sx ?? 1,
    sy: overrides.sy ?? 1,
    sz: overrides.sz ?? 1,
    initial: {
      tx: overrides.tx ?? tx,
      ty: overrides.ty ?? ty,
      tz: overrides.tz ?? tz,
      rx: overrides.rx ?? 0,
      ry: overrides.ry ?? 0,
      rz: overrides.rz ?? 0,
      sx: overrides.sx ?? 1,
      sy: overrides.sy ?? 1,
      sz: overrides.sz ?? 1
    }
  };

  return object3d;
}

function getSelectedObject() {
  return state.objects.find((entry) => entry.id === state.selectedId) || null;
}

function refreshObjectList() {
  ui.objectList.innerHTML = "";

  for (const entry of state.objects) {
    const option = document.createElement("option");
    option.value = String(entry.id);
    option.textContent = entry.name;

    if (entry.id === state.selectedId) {
      option.selected = true;
    }

    ui.objectList.appendChild(option);
  }
}

function updateSelectedObjectLabel() {
  const object3d = getSelectedObject();

  if (!object3d) {
    ui.selectedObjectLabel.textContent = "No object selected.";
    return;
  }

  ui.selectedObjectLabel.textContent = `Selected: ${object3d.name}`;
}

function setPairValues(rangeElement, inputElement, value) {
  rangeElement.value = String(value);
  inputElement.value = String(value);
}

function syncControlsFromObject(object3d) {
  if (!object3d) {
    return;
  }

  setPairValues(ui.txRange, ui.txInput, Math.round(object3d.tx));
  setPairValues(ui.tyRange, ui.tyInput, Math.round(object3d.ty));
  setPairValues(ui.tzRange, ui.tzInput, Math.round(object3d.tz));

  setPairValues(ui.rxRange, ui.rxInput, Math.round(object3d.rx));
  setPairValues(ui.ryRange, ui.ryInput, Math.round(object3d.ry));
  setPairValues(ui.rzRange, ui.rzInput, Math.round(object3d.rz));

  setPairValues(ui.sxRange, ui.sxInput, Number(object3d.sx.toFixed(2)));
  setPairValues(ui.syRange, ui.syInput, Number(object3d.sy.toFixed(2)));
  setPairValues(ui.szRange, ui.szInput, Number(object3d.sz.toFixed(2)));
}

function selectObjectById(id) {
  const object3d = state.objects.find((entry) => entry.id === id);
  state.selectedId = object3d ? id : null;

  refreshObjectList();
  updateSelectedObjectLabel();
  syncControlsFromObject(getSelectedObject());
  updateMatrixDisplay();
  renderScene();
}

function addObject(type) {
  const object3d = createObject(type);
  state.objects.push(object3d);
  selectObjectById(object3d.id);
}

function resetObject(object3d) {
  object3d.tx = object3d.initial.tx;
  object3d.ty = object3d.initial.ty;
  object3d.tz = object3d.initial.tz;
  object3d.rx = object3d.initial.rx;
  object3d.ry = object3d.initial.ry;
  object3d.rz = object3d.initial.rz;
  object3d.sx = object3d.initial.sx;
  object3d.sy = object3d.initial.sy;
  object3d.sz = object3d.initial.sz;
}

function deleteSelectedObject() {
  const selected = getSelectedObject();

  if (!selected) {
    return;
  }

  if (state.objects.length === 1) {
    resetObject(selected);
    syncControlsFromObject(selected);
    updateMatrixDisplay();
    renderScene();
    return;
  }

  state.objects = state.objects.filter((entry) => entry.id !== selected.id);

  if (state.objects.length === 0) {
    state.selectedId = null;
    refreshObjectList();
    updateSelectedObjectLabel();
    updateMatrixDisplay();
    renderScene();
    return;
  }

  state.selectedId = state.objects[state.objects.length - 1].id;
  refreshObjectList();
  updateSelectedObjectLabel();
  syncControlsFromObject(getSelectedObject());
  updateMatrixDisplay();
  renderScene();
}

function resetAllObjects() {
  for (const object3d of state.objects) {
    resetObject(object3d);
  }

  syncControlsFromObject(getSelectedObject());
  updateMatrixDisplay();
  renderScene();
}

function bindRangeInput(rangeElement, inputElement, onChange) {
  const applyChange = (rawValue) => {
    let parsed = Number(rawValue);
    if (Number.isNaN(parsed)) {
      return;
    }

    const min = Number(rangeElement.min);
    const max = Number(rangeElement.max);

    if (Number.isFinite(min) && Number.isFinite(max)) {
      parsed = clamp(parsed, min, max);
    }

    rangeElement.value = String(parsed);
    inputElement.value = String(parsed);
    onChange(parsed);
  };

  rangeElement.addEventListener("input", () => applyChange(rangeElement.value));
  inputElement.addEventListener("input", () => applyChange(inputElement.value));
}

function setupControlHandlers() {
  ui.addObjectBtn.addEventListener("click", () => {
    addObject(ui.objectTemplate.value);
  });

  ui.deleteObjectBtn.addEventListener("click", () => {
    deleteSelectedObject();
  });

  ui.objectList.addEventListener("change", () => {
    selectObjectById(Number(ui.objectList.value));
  });

  bindRangeInput(ui.txRange, ui.txInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.tx = value;
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.tyRange, ui.tyInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.ty = value;
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.tzRange, ui.tzInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.tz = value;
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.rxRange, ui.rxInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.rx = normalizeAngle(value);
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.ryRange, ui.ryInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.ry = normalizeAngle(value);
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.rzRange, ui.rzInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.rz = normalizeAngle(value);
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.sxRange, ui.sxInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.sx = clamp(value, 0.2, 3);
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.syRange, ui.syInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.sy = clamp(value, 0.2, 3);
    updateMatrixDisplay();
    renderScene();
  });

  bindRangeInput(ui.szRange, ui.szInput, (value) => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    object3d.sz = clamp(value, 0.2, 3);
    updateMatrixDisplay();
    renderScene();
  });

  ui.resetSelectedBtn.addEventListener("click", () => {
    const object3d = getSelectedObject();
    if (!object3d) {
      return;
    }

    resetObject(object3d);
    syncControlsFromObject(object3d);
    updateMatrixDisplay();
    renderScene();
  });

  ui.resetAllBtn.addEventListener("click", () => {
    resetAllObjects();
  });

  for (const button of testButtons) {
    button.addEventListener("click", () => {
      applySampleTest(Number(button.dataset.test));
    });
  }
}

function setupCanvasInteraction() {
  canvas.style.cursor = "grab";

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    state.orbit.active = true;
    state.orbit.pointerId = event.pointerId;
    state.orbit.lastX = event.clientX;
    state.orbit.lastY = event.clientY;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.orbit.active || event.pointerId !== state.orbit.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.orbit.lastX;
    const deltaY = event.clientY - state.orbit.lastY;

    state.orbit.lastX = event.clientX;
    state.orbit.lastY = event.clientY;

    state.cameraYaw += deltaX * 0.009;
    state.cameraPitch = clamp(
      state.cameraPitch + deltaY * 0.007,
      toRadians(-80),
      toRadians(80)
    );

    updateMatrixDisplay();
    renderScene();
  });

  const stopOrbit = (event) => {
    if (!state.orbit.active || event.pointerId !== state.orbit.pointerId) {
      return;
    }

    state.orbit.active = false;
    state.orbit.pointerId = null;
    canvas.style.cursor = "grab";

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerup", stopOrbit);
  canvas.addEventListener("pointercancel", stopOrbit);
  canvas.addEventListener("pointerleave", (event) => {
    if (state.orbit.active) {
      stopOrbit(event);
    }
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.cameraDistance = clamp(state.cameraDistance + event.deltaY * 0.7, 280, 1400);
      updateMatrixDisplay();
      renderScene();
    },
    { passive: false }
  );
}

function applySampleTest(testId) {
  const object3d = getSelectedObject();
  if (!object3d) {
    return;
  }

  if (testId === 1) {
    object3d.tx = 130;
    object3d.ty = 20;
    object3d.tz = 120;
    object3d.rx = 22;
    object3d.ry = 38;
    object3d.rz = 0;
    object3d.sx = 1;
    object3d.sy = 1;
    object3d.sz = 1;
  } else if (testId === 2) {
    object3d.tx = -140;
    object3d.ty = 40;
    object3d.tz = 60;
    object3d.rx = -28;
    object3d.ry = 12;
    object3d.rz = 34;
    object3d.sx = 1.65;
    object3d.sy = 0.78;
    object3d.sz = 1.24;
  } else {
    object3d.tx = 20;
    object3d.ty = -35;
    object3d.tz = 220;
    object3d.rx = 44;
    object3d.ry = -30;
    object3d.rz = 15;
    object3d.sx = 0.92;
    object3d.sy = 1.32;
    object3d.sz = 0.92;
  }

  syncControlsFromObject(object3d);
  updateMatrixDisplay();
  renderScene();
}

function identity4() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

function multiply4(a, b) {
  const result = identity4();

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      result[row][col] =
        a[row][0] * b[0][col] +
        a[row][1] * b[1][col] +
        a[row][2] * b[2][col] +
        a[row][3] * b[3][col];
    }
  }

  return result;
}

function translationMatrix4(tx, ty, tz) {
  return [
    [1, 0, 0, tx],
    [0, 1, 0, ty],
    [0, 0, 1, tz],
    [0, 0, 0, 1]
  ];
}

function scaleMatrix4(sx, sy, sz) {
  return [
    [sx, 0, 0, 0],
    [0, sy, 0, 0],
    [0, 0, sz, 0],
    [0, 0, 0, 1]
  ];
}

function rotationMatrixX(angleRad) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1]
  ];
}

function rotationMatrixY(angleRad) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1]
  ];
}

function rotationMatrixZ(angleRad) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

function buildTransformMatrix(object3d) {
  let matrix = identity4();

  matrix = multiply4(matrix, translationMatrix4(object3d.tx, object3d.ty, object3d.tz));
  matrix = multiply4(matrix, rotationMatrixZ(toRadians(object3d.rz)));
  matrix = multiply4(matrix, rotationMatrixY(toRadians(object3d.ry)));
  matrix = multiply4(matrix, rotationMatrixX(toRadians(object3d.rx)));
  matrix = multiply4(matrix, scaleMatrix4(object3d.sx, object3d.sy, object3d.sz));

  return matrix;
}

function applyMatrix4(matrix, point) {
  return {
    x: matrix[0][0] * point.x + matrix[0][1] * point.y + matrix[0][2] * point.z + matrix[0][3],
    y: matrix[1][0] * point.x + matrix[1][1] * point.y + matrix[1][2] * point.z + matrix[1][3],
    z: matrix[2][0] * point.x + matrix[2][1] * point.y + matrix[2][2] * point.z + matrix[2][3]
  };
}

function transformVertices(object3d) {
  const matrix = buildTransformMatrix(object3d);
  return object3d.vertices.map((vertex) => applyMatrix4(matrix, vertex));
}

function applyCameraView(point) {
  const cosYaw = Math.cos(state.cameraYaw);
  const sinYaw = Math.sin(state.cameraYaw);
  const cosPitch = Math.cos(state.cameraPitch);
  const sinPitch = Math.sin(state.cameraPitch);

  const xYaw = point.x * cosYaw + point.z * sinYaw;
  const zYaw = -point.x * sinYaw + point.z * cosYaw;

  return {
    x: xYaw,
    y: point.y * cosPitch - zYaw * sinPitch,
    z: point.y * sinPitch + zYaw * cosPitch
  };
}

function projectPoint(point) {
  const viewedPoint = applyCameraView(point);
  const depth = state.cameraDistance + viewedPoint.z;

  if (depth < 45) {
    return null;
  }

  const center = getCanvasCenter();
  const perspective = state.cameraDistance / depth;

  return {
    x: center.x + viewedPoint.x * perspective,
    y: center.y - viewedPoint.y * perspective,
    depth
  };
}

function drawProjectedLine(pointA, pointB, color, width = 1.8) {
  const start = projectPoint(pointA);
  const end = projectPoint(pointB);

  if (!start || !end) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawAxes() {
  const axisLength = 250;
  const origin = { x: 0, y: 0, z: 0 };

  drawProjectedLine(origin, { x: axisLength, y: 0, z: 0 }, "rgba(156, 16, 53, 0.88)", 2.4);
  drawProjectedLine(origin, { x: 0, y: axisLength, z: 0 }, "rgba(122, 34, 62, 0.82)", 2.4);
  drawProjectedLine(origin, { x: 0, y: 0, z: axisLength }, "rgba(198, 20, 68, 0.98)", 3.2);

  const xTip = projectPoint({ x: axisLength, y: 0, z: 0 });
  const yTip = projectPoint({ x: 0, y: axisLength, z: 0 });
  const zTip = projectPoint({ x: 0, y: 0, z: axisLength });

  ctx.fillStyle = "rgba(42, 15, 24, 0.88)";
  ctx.font = "12px 'IBM Plex Mono', monospace";

  if (xTip) {
    ctx.fillText("X", xTip.x + 6, xTip.y - 6);
  }

  if (yTip) {
    ctx.fillText("Y", yTip.x + 6, yTip.y - 6);
  }

  if (zTip) {
    ctx.fillText("Z", zTip.x + 6, zTip.y - 6);
  }
}

function drawObjectWireframe(entry, selected) {
  const projected = entry.transformed.map((vertex) => projectPoint(vertex));

  ctx.strokeStyle = selected ? "rgba(82, 10, 35, 0.96)" : entry.object3d.color;
  ctx.lineWidth = selected ? 2.8 : 1.8;

  for (const edge of entry.object3d.edges) {
    const start = projected[edge[0]];
    const end = projected[edge[1]];

    if (!start || !end) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  if (selected) {
    ctx.fillStyle = "rgba(198, 20, 68, 0.58)";

    for (const point of projected) {
      if (!point) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function updateMatrixDisplay() {
  const object3d = getSelectedObject();
  const yawDegrees = (state.cameraYaw * 180) / Math.PI;
  const pitchDegrees = (state.cameraPitch * 180) / Math.PI;

  if (!object3d) {
    ui.matrixOutput.textContent = `No object selected.\n\nCamera Distance: ${state.cameraDistance.toFixed(1)}\nCamera Yaw: ${yawDegrees.toFixed(1)} deg\nCamera Pitch: ${pitchDegrees.toFixed(1)} deg`;
    return;
  }

  const matrix = buildTransformMatrix(object3d);
  const rows = matrix.map((row) => row.map((value) => value.toFixed(3).padStart(10, " ")).join(" "));

  ui.matrixOutput.textContent = `${rows.join("\n")}\n\nCamera Distance: ${state.cameraDistance.toFixed(1)}\nCamera Yaw: ${yawDegrees.toFixed(1)} deg\nCamera Pitch: ${pitchDegrees.toFixed(1)} deg`;
}

function renderScene() {
  resizeCanvas();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawQueue = state.objects
    .map((object3d) => {
      const transformed = transformVertices(object3d);
      const avgViewZ = transformed
        .map((point) => applyCameraView(point).z)
        .reduce((sum, value) => sum + value, 0) / transformed.length;

      return {
        object3d,
        transformed,
        avgViewZ
      };
    })
    .sort((a, b) => a.avgViewZ - b.avgViewZ);

  for (const entry of drawQueue) {
    drawObjectWireframe(entry, entry.object3d.id === state.selectedId);
  }

  drawAxes();

  if (drawQueue.length === 0) {
    ctx.fillStyle = "rgba(42, 15, 24, 0.78)";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.fillText("Select object type and click Add", 16, 24);
  }
}

function serializeScene() {
  return {
    camera: {
      distance: state.cameraDistance,
      yaw: state.cameraYaw,
      pitch: state.cameraPitch
    },
    selectedObjectName: getSelectedObject() ? getSelectedObject().name : null,
    objects: state.objects.map((object3d) => ({
      type: object3d.type,
      name: object3d.name,
      color: object3d.color,
      tx: object3d.tx,
      ty: object3d.ty,
      tz: object3d.tz,
      rx: object3d.rx,
      ry: object3d.ry,
      rz: object3d.rz,
      sx: object3d.sx,
      sy: object3d.sy,
      sz: object3d.sz
    }))
  };
}

function loadSceneData(sceneData) {
  state.objects = [];
  state.selectedId = null;
  state.nextId = 1;

  if (sceneData && sceneData.camera) {
    state.cameraDistance = clamp(Number(sceneData.camera.distance) || 620, 280, 1400);
    state.cameraYaw = Number.isFinite(sceneData.camera.yaw) ? sceneData.camera.yaw : toRadians(-25);
    state.cameraPitch = clamp(
      Number.isFinite(sceneData.camera.pitch) ? sceneData.camera.pitch : toRadians(12),
      toRadians(-80),
      toRadians(80)
    );
  }

  if (sceneData && Array.isArray(sceneData.objects)) {
    for (const savedObject of sceneData.objects) {
      const objectType =
        savedObject && (savedObject.type === "cube" || savedObject.type === "cuboid" || savedObject.type === "cone")
          ? savedObject.type
          : "cube";

      const object3d = createObject(objectType, {
        name: savedObject.name,
        color: savedObject.color,
        tx: savedObject.tx,
        ty: savedObject.ty,
        tz: savedObject.tz,
        rx: savedObject.rx,
        ry: savedObject.ry,
        rz: savedObject.rz,
        sx: savedObject.sx,
        sy: savedObject.sy,
        sz: savedObject.sz
      });

      state.objects.push(object3d);
    }
  }

  let selected = null;
  if (sceneData && sceneData.selectedObjectName) {
    selected = state.objects.find((entry) => entry.name === sceneData.selectedObjectName) || null;
  }

  if (!selected && state.objects.length > 0) {
    selected = state.objects[0];
  }

  state.selectedId = selected ? selected.id : null;
  refreshObjectList();
  updateSelectedObjectLabel();
  syncControlsFromObject(getSelectedObject());
  updateMatrixDisplay();
  renderScene();
}

async function requestJson(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_ORIGIN}${API_BASE}${path}`, {
    ...options,
    headers,
    body:
      options.body !== undefined && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && payload.error ? payload.error : "Request failed.";
    throw new Error(message);
  }

  return payload;
}

async function saveAndShareScene() {
  console.log("saveAndShareScene called");
  setStatus(ui.cloudStatus, "Saving scene...", "info");

  const scenePayload = {
    name: ui.sceneName.value.trim() || "Untitled Scene",
    data: serializeScene()
  };

  try {
    let result;

    if (state.activeSceneId) {
      console.log("Updating scene:", state.activeSceneId);
      result = await requestJson(`/scenes/${state.activeSceneId}`, {
        method: "PUT",
        body: scenePayload
      });
    } else {
      console.log("Creating new scene");
      result = await requestJson("/scenes", {
        method: "POST",
        body: scenePayload
      });
    }

    console.log("Save result:", result);
    state.activeSceneId = result.scene.id;
    const shareId = result.scene.shareId;
    const shareUrl = `${window.location.origin}/?scene=${shareId}`;
    ui.shareLink.value = shareUrl;
    ui.sceneName.value = result.scene.name;
    setStatus(ui.cloudStatus, "Scene saved! Share link ready.", "success");
  } catch (error) {
    console.error("Save failed:", error);
    setStatus(ui.cloudStatus, error.message, "error");
  }
}

async function copyShareLink() {
  const link = ui.shareLink.value.trim();

  if (!link) {
    setStatus(ui.cloudStatus, "Save a scene first to get a share link.", "error");
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      ui.shareLink.select();
      document.execCommand("copy");
    }

    setStatus(ui.cloudStatus, "Share link copied!", "success");
  } catch (_error) {
    setStatus(ui.cloudStatus, "Could not copy link automatically.", "error");
  }
}

function setupSceneCloudHandlers() {
  ui.saveSceneBtn.addEventListener("click", saveAndShareScene);
  ui.copyShareBtn.addEventListener("click", copyShareLink);
}

async function loadSharedSceneFromQueryIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get("scene");

  if (!shareId) {
    return;
  }

  try {
    const result = await requestJson(`/share/${encodeURIComponent(shareId)}`, {
      method: "GET"
    });

    loadSceneData(result.scene.data);
    state.activeSceneId = result.scene.id;
    ui.sceneName.value = result.scene.name;
    ui.shareLink.value = window.location.href;
    setStatus(ui.cloudStatus, "Loaded shared scene from link.", "success");
  } catch (error) {
    setStatus(ui.cloudStatus, `Could not load shared scene: ${error.message}`, "error");
  }
}

function initializeEmptyWorkspace() {
  state.objects = [];
  state.selectedId = null;
  refreshObjectList();
  updateSelectedObjectLabel();
  updateMatrixDisplay();
  renderScene();
}

async function initialize() {
  setupControlHandlers();
  setupCanvasInteraction();
  setupSceneCloudHandlers();
  initializeEmptyWorkspace();
  await loadSharedSceneFromQueryIfPresent();
}

initialize();
