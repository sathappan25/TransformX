import { palette } from "./config.js";
import { clamp, normalizeAngle, toRadians } from "./math-utils.js";

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

  cameraRange: document.getElementById("cameraRange"),
  cameraInput: document.getElementById("cameraInput"),
  resetSelectedBtn: document.getElementById("resetSelectedBtn"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  matrixOutput: document.getElementById("matrixOutput")
};

const testButtons = Array.from(document.querySelectorAll(".test-grid .test"));

const state = {
  objects: [],
  nextId: 1,
  selectedId: null,
  cameraDistance: 620
};

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
      label: "Cuboid",
      ...createCuboidGeometry()
    };
  }

  if (type === "cone") {
    return {
      label: "Cone",
      ...createConeGeometry()
    };
  }

  return {
    label: "Cube",
    ...createCubeGeometry()
  };
}

function createObject(type) {
  const template = buildTemplate(type);
  const index = state.objects.length;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const tx = -190 + column * 190;
  const ty = 0;
  const tz = row * 120;
  const typeIndex = state.objects.filter((object3d) => object3d.type === type).length + 1;

  return {
    id: state.nextId++,
    name: `${type}${typeIndex}`,
    type,
    vertices: template.vertices,
    edges: template.edges,
    color: palette[index % palette.length],
    tx,
    ty,
    tz,
    rx: 0,
    ry: 0,
    rz: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    initial: {
      tx,
      ty,
      tz,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: 1,
      sy: 1,
      sz: 1
    }
  };
}

function getSelectedObject() {
  return state.objects.find((object3d) => object3d.id === state.selectedId) || null;
}

function refreshObjectList() {
  ui.objectList.innerHTML = "";

  for (const object3d of state.objects) {
    const option = document.createElement("option");
    option.value = String(object3d.id);
    option.textContent = object3d.name;
    if (object3d.id === state.selectedId) {
      option.selected = true;
    }
    ui.objectList.appendChild(option);
  }
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

  setPairValues(ui.cameraRange, ui.cameraInput, Math.round(state.cameraDistance));
}

function updateSelectedObjectLabel() {
  const object3d = getSelectedObject();

  if (!object3d) {
    ui.selectedObjectLabel.textContent = "No object selected.";
    return;
  }

  ui.selectedObjectLabel.textContent = `Selected: ${object3d.name}`;
}

function selectObjectById(id) {
  state.selectedId = id;
  refreshObjectList();
  const object3d = getSelectedObject();
  syncControlsFromObject(object3d);
  updateSelectedObjectLabel();
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

  state.objects = state.objects.filter((object3d) => object3d.id !== selected.id);

  if (state.objects.length > 0) {
    selectObjectById(state.objects[state.objects.length - 1].id);
    return;
  }

  state.selectedId = null;
  refreshObjectList();
  updateSelectedObjectLabel();
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

function bindRangeInput(rangeElement, numberElement, onChange) {
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
    numberElement.value = String(parsed);
    onChange(parsed);
  };

  rangeElement.addEventListener("input", () => applyChange(rangeElement.value));
  numberElement.addEventListener("input", () => applyChange(numberElement.value));
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

  bindRangeInput(ui.cameraRange, ui.cameraInput, (value) => {
    state.cameraDistance = clamp(value, 280, 1200);
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

function updateMatrixDisplay() {
  const object3d = getSelectedObject();
  if (!object3d) {
    ui.matrixOutput.textContent = "Select an object to view matrix values.";
    return;
  }

  const matrix = buildTransformMatrix(object3d);
  const rows = matrix.map((row) => row.map((value) => value.toFixed(3).padStart(10, " ")).join(" "));

  ui.matrixOutput.textContent = `${rows.join("\n")}\n\nCamera Distance: ${state.cameraDistance.toFixed(1)}`;
}

function projectPoint(point) {
  const depth = state.cameraDistance + point.z;
  if (depth < 45) {
    return null;
  }

  const center = getCanvasCenter();
  const perspective = state.cameraDistance / depth;

  // Keep default orientation straight while still visualizing z-depth.
  const zSkewX = point.z * 0.28;
  const zSkewY = 0;

  return {
    x: center.x + (point.x + zSkewX) * perspective,
    y: center.y - (point.y + zSkewY) * perspective,
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

  drawProjectedLine(origin, { x: axisLength, y: 0, z: 0 }, "rgba(156, 16, 53, 0.88)", 2.3);
  drawProjectedLine(origin, { x: 0, y: axisLength, z: 0 }, "rgba(122, 34, 62, 0.82)", 2.3);
  drawProjectedLine(origin, { x: 0, y: 0, z: axisLength }, "rgba(198, 20, 68, 0.98)", 2.8);

  const xTip = projectPoint({ x: axisLength, y: 0, z: 0 });
  const yTip = projectPoint({ x: 0, y: axisLength, z: 0 });
  const zTip = projectPoint({ x: 0, y: 0, z: axisLength });

  ctx.fillStyle = "rgba(20, 33, 43, 0.85)";
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

function renderScene() {
  resizeCanvas();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawAxes();

  const drawQueue = state.objects
    .map((object3d) => {
      const transformed = transformVertices(object3d);
      const avgZ = transformed.reduce((sum, point) => sum + point.z, 0) / transformed.length;

      return {
        object3d,
        transformed,
        avgZ
      };
    })
    .sort((a, b) => a.avgZ - b.avgZ);

  for (const entry of drawQueue) {
    drawObjectWireframe(entry, entry.object3d.id === state.selectedId);
  }

  if (drawQueue.length === 0) {
    ctx.fillStyle = "rgba(20, 33, 43, 0.75)";
    ctx.font = "14px 'IBM Plex Mono', monospace";
    ctx.fillText("Add a 3D object to start", 16, 24);
  }
}

function initialize() {
  setupControlHandlers();

  addObject("cube");
  addObject("cuboid");
  addObject("cone");

  selectObjectById(state.objects[0].id);

  window.addEventListener("resize", renderScene);
  renderScene();
}

initialize();
