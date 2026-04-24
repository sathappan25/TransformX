const canvas = document.getElementById("sceneCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  shapeTemplate: document.getElementById("shapeTemplate"),
  addShapeBtn: document.getElementById("addShapeBtn"),
  deleteShapeBtn: document.getElementById("deleteShapeBtn"),
  shapeList: document.getElementById("shapeList"),
  selectedShapeLabel: document.getElementById("selectedShapeLabel"),

  txRange: document.getElementById("txRange"),
  txInput: document.getElementById("txInput"),
  tyRange: document.getElementById("tyRange"),
  tyInput: document.getElementById("tyInput"),
  rotRange: document.getElementById("rotRange"),
  rotInput: document.getElementById("rotInput"),
  sxRange: document.getElementById("sxRange"),
  sxInput: document.getElementById("sxInput"),
  syRange: document.getElementById("syRange"),
  syInput: document.getElementById("syInput"),

  pivotMode: document.getElementById("pivotMode"),
  pivotX: document.getElementById("pivotX"),
  pivotY: document.getElementById("pivotY"),
  pickPivotBtn: document.getElementById("pickPivotBtn"),

  animationMode: document.getElementById("animationMode"),
  animSpeedRange: document.getElementById("animSpeedRange"),
  animSpeedInput: document.getElementById("animSpeedInput"),
  toggleAnimationBtn: document.getElementById("toggleAnimationBtn"),
  stopAnimationBtn: document.getElementById("stopAnimationBtn"),

  showOriginal: document.getElementById("showOriginal"),
  showPseudo3D: document.getElementById("showPseudo3D"),
  resetSelectedBtn: document.getElementById("resetSelectedBtn"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  matrixOutput: document.getElementById("matrixOutput")
};

const testButtons = Array.from(document.querySelectorAll(".test-grid .test"));

const palette = ["#ef6c2f", "#188f86", "#3b6ea8", "#db4f7a", "#8b5cf6", "#5f8c3f"];

const state = {
  shapes: [],
  nextId: 1,
  selectedId: null,
  showOriginal: true,
  showPseudo3D: false,
  pickingPivot: false,
  dragging: {
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0
  },
  lastFrameTime: performance.now()
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function normalizeAngle(degrees) {
  let value = degrees;
  while (value > 180) {
    value -= 360;
  }
  while (value < -180) {
    value += 360;
  }
  return value;
}

function getCanvasCenter() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2
  };
}

function worldToScreen(point) {
  const center = getCanvasCenter();
  return {
    x: point.x + center.x,
    y: point.y + center.y
  };
}

function screenToWorld(point) {
  const center = getCanvasCenter();
  return {
    x: point.x - center.x,
    y: point.y - center.y
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(400, Math.floor(rect.width));
  const height = Math.max(400, Math.floor(rect.height));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function buildTemplate(type) {
  if (type === "triangle") {
    return {
      label: "Triangle",
      points: [
        { x: 0, y: -72 },
        { x: 84, y: 58 },
        { x: -84, y: 58 }
      ]
    };
  }

  if (type === "pentagon") {
    const points = [];
    const radius = 78;

    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      points.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      });
    }

    return {
      label: "Pentagon",
      points
    };
  }

  return {
    label: "Rectangle",
    points: [
      { x: -85, y: -58 },
      { x: 85, y: -58 },
      { x: 85, y: 58 },
      { x: -85, y: 58 }
    ]
  };
}

function createShape(type) {
  const template = buildTemplate(type);
  const index = state.shapes.length;
  const offsetX = -120 + (index % 4) * 85;
  const offsetY = -95 + Math.floor(index / 4) * 85;
  const color = palette[index % palette.length];

  return {
    id: state.nextId++,
    name: `${template.label} ${index + 1}`,
    type,
    points: template.points,
    fill: color,
    x: offsetX,
    y: offsetY,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    pivotMode: "center",
    pivot: { x: 0, y: 0 },
    animation: {
      active: false,
      mode: "none",
      speed: 1,
      phase: 0,
      baseScaleX: 1,
      baseScaleY: 1
    },
    initial: {
      x: offsetX,
      y: offsetY,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      pivotMode: "center",
      pivot: { x: 0, y: 0 }
    }
  };
}

function getSelectedShape() {
  return state.shapes.find((shape) => shape.id === state.selectedId) || null;
}

function refreshShapeList() {
  ui.shapeList.innerHTML = "";

  for (const shape of state.shapes) {
    const option = document.createElement("option");
    option.value = String(shape.id);
    option.textContent = shape.name;
    if (shape.id === state.selectedId) {
      option.selected = true;
    }
    ui.shapeList.appendChild(option);
  }
}

function setPairValues(rangeElement, inputElement, value) {
  rangeElement.value = String(value);
  inputElement.value = String(value);
}

function syncControlsFromShape(shape) {
  if (!shape) {
    return;
  }

  setPairValues(ui.txRange, ui.txInput, Math.round(shape.x));
  setPairValues(ui.tyRange, ui.tyInput, Math.round(shape.y));
  setPairValues(ui.rotRange, ui.rotInput, Math.round(shape.rotation));
  setPairValues(ui.sxRange, ui.sxInput, Number(shape.scaleX.toFixed(2)));
  setPairValues(ui.syRange, ui.syInput, Number(shape.scaleY.toFixed(2)));

  ui.pivotMode.value = shape.pivotMode;
  ui.pivotX.value = String(Math.round(shape.pivot.x));
  ui.pivotY.value = String(Math.round(shape.pivot.y));

  ui.animationMode.value = shape.animation.mode;
  setPairValues(
    ui.animSpeedRange,
    ui.animSpeedInput,
    Number(shape.animation.speed.toFixed(1))
  );

  updatePivotInputsState();
  updateAnimationButtonLabel();
}

function updateSelectedShapeLabel() {
  const shape = getSelectedShape();

  if (!shape) {
    ui.selectedShapeLabel.textContent = "No shape selected.";
    return;
  }

  ui.selectedShapeLabel.textContent = `Selected: ${shape.name}`;
}

function selectShapeById(id) {
  state.selectedId = id;
  refreshShapeList();
  const shape = getSelectedShape();
  syncControlsFromShape(shape);
  updateSelectedShapeLabel();
  updateMatrixDisplay();
}

function addShape(type) {
  const newShape = createShape(type);
  state.shapes.push(newShape);
  selectShapeById(newShape.id);
}

function deleteSelectedShape() {
  const selected = getSelectedShape();

  if (!selected) {
    return;
  }

  if (state.shapes.length === 1) {
    resetShape(selected);
    return;
  }

  state.shapes = state.shapes.filter((shape) => shape.id !== selected.id);

  if (state.shapes.length > 0) {
    state.selectedId = state.shapes[state.shapes.length - 1].id;
  } else {
    state.selectedId = null;
  }

  refreshShapeList();
  updateSelectedShapeLabel();
  syncControlsFromShape(getSelectedShape());
  updateMatrixDisplay();
}

function resetShape(shape) {
  shape.x = shape.initial.x;
  shape.y = shape.initial.y;
  shape.rotation = shape.initial.rotation;
  shape.scaleX = shape.initial.scaleX;
  shape.scaleY = shape.initial.scaleY;
  shape.pivotMode = shape.initial.pivotMode;
  shape.pivot = {
    x: shape.initial.pivot.x,
    y: shape.initial.pivot.y
  };
  shape.animation.active = false;
  shape.animation.mode = "none";
  shape.animation.speed = 1;
  shape.animation.phase = 0;
  shape.animation.baseScaleX = shape.scaleX;
  shape.animation.baseScaleY = shape.scaleY;
}

function resetAllShapes() {
  for (const shape of state.shapes) {
    resetShape(shape);
  }
  syncControlsFromShape(getSelectedShape());
  updateMatrixDisplay();
}

function updatePivotInputsState() {
  const useCustomPivot = ui.pivotMode.value === "custom";
  ui.pivotX.disabled = !useCustomPivot;
  ui.pivotY.disabled = !useCustomPivot;
}

function updateAnimationButtonLabel() {
  const shape = getSelectedShape();
  if (!shape) {
    ui.toggleAnimationBtn.textContent = "Start Animation";
    return;
  }

  ui.toggleAnimationBtn.textContent = shape.animation.active
    ? "Pause Animation"
    : "Start Animation";
}

function bindRangeInput(rangeElement, numberElement, onChange) {
  const applyChange = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    rangeElement.value = String(parsed);
    numberElement.value = String(parsed);
    onChange(parsed);
  };

  rangeElement.addEventListener("input", () => applyChange(rangeElement.value));
  numberElement.addEventListener("input", () => applyChange(numberElement.value));
}

function setupControlHandlers() {
  ui.addShapeBtn.addEventListener("click", () => {
    addShape(ui.shapeTemplate.value);
  });

  ui.deleteShapeBtn.addEventListener("click", () => {
    deleteSelectedShape();
  });

  ui.shapeList.addEventListener("change", () => {
    selectShapeById(Number(ui.shapeList.value));
  });

  bindRangeInput(ui.txRange, ui.txInput, (value) => {
    const shape = getSelectedShape();
    if (!shape) {
      return;
    }
    shape.x = value;
    updateMatrixDisplay();
  });

  bindRangeInput(ui.tyRange, ui.tyInput, (value) => {
    const shape = getSelectedShape();
    if (!shape) {
      return;
    }
    shape.y = value;
    updateMatrixDisplay();
  });

  bindRangeInput(ui.rotRange, ui.rotInput, (value) => {
    const shape = getSelectedShape();
    if (!shape) {
      return;
    }
    shape.rotation = normalizeAngle(value);
    updateMatrixDisplay();
  });

  bindRangeInput(ui.sxRange, ui.sxInput, (value) => {
    const shape = getSelectedShape();
    if (!shape) {
      return;
    }
    shape.scaleX = clamp(value, 0.2, 3);
    shape.animation.baseScaleX = shape.scaleX;
    updateMatrixDisplay();
  });
