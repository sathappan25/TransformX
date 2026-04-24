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
