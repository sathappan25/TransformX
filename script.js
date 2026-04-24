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
