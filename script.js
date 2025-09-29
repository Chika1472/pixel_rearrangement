const CANVAS_SIZE = 512;
const EASING = 0.08;
const STOP_THRESHOLD = 0.35;

const canvas = document.getElementById("displayCanvas");
const ctx = canvas.getContext("2d");
const targetInput = document.getElementById("targetImageUpload");
const fileInput = document.getElementById("sourceImageUpload");
const transformButton = document.getElementById("transformButton");
const resetButton = document.getElementById("resetButton");
const drawingModeButton = document.getElementById("drawingModeButton");

let sourcePixels = [];
let targetPixels = [];
let targetPixelsSorted = [];
let particles = [];
let animationFrameId = null;
let isAnimating = false;
let drawingMode = false;
let targetAssignmentIndex = 0;
let isMouseDown = false;

/**
 * Calculate perceived brightness for a pixel.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
function getBrightness(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Convert an HTMLImageElement into an array of pixel objects.
 * Transparent pixels are omitted to limit particle count.
 * @param {HTMLImageElement} image
 * @param {number} [width=CANVAS_SIZE]
 * @param {number} [height=CANVAS_SIZE]
 * @returns {Array<{x:number, y:number, color:string, brightness:number}>>}
 */
function getPixelDataFromImage(image, width = CANVAS_SIZE, height = CANVAS_SIZE) {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });

  offscreenCtx.clearRect(0, 0, width, height);
  offscreenCtx.drawImage(image, 0, 0, width, height);

  const { data } = offscreenCtx.getImageData(0, 0, width, height);
  const pixels = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (a === 0) continue;

      const alpha = a / 255;
      pixels.push({
        x,
        y,
        color: `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`,
        brightness: getBrightness(r, g, b),
      });
    }
  }

  return pixels;
}

/**
 * Prepare the particles array by mapping sorted source pixels to target pixels.
 */
function createParticleMapping() {
  if (!sourcePixels.length || !targetPixelsSorted.length) return;

  const sortedSource = [...sourcePixels].sort((a, b) => a.brightness - b.brightness);
  const count = Math.min(sortedSource.length, targetPixelsSorted.length);

  particles = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const src = sortedSource[i];
    const tgt = targetPixelsSorted[i];
    const sourceX = src.originalX ?? src.x;
    const sourceY = src.originalY ?? src.y;
    particles[i] = {
      currentX: sourceX,
      currentY: sourceY,
      targetX: tgt.x,
      targetY: tgt.y,
      color: src.color,
      sourceX,
      sourceY,
    };
  }
}

/**
 * Draw the source image onto the canvas for immediate visual feedback.
 * @param {HTMLImageElement} image
 */
function displaySourceImage(image) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

/**
 * Animation loop.
 */
function animate() {
  if (!particles.length) {
    isAnimating = false;
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let particlesAtRest = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const dx = particle.targetX - particle.currentX;
    const dy = particle.targetY - particle.currentY;

    particle.currentX += dx * EASING;
    particle.currentY += dy * EASING;

    if (Math.abs(dx) < STOP_THRESHOLD && Math.abs(dy) < STOP_THRESHOLD) {
      particlesAtRest += 1;
    }

    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.currentX, particle.currentY, 1, 1);
  }

  if (particlesAtRest === particles.length) {
    isAnimating = false;
    animationFrameId = null;
    return;
  }

  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Start the animation loop if it isn't already running.
 */
function ensureAnimation() {
  if (!isAnimating) {
    isAnimating = true;
    animationFrameId = requestAnimationFrame(animate);
  }
}

/**
 * Stop the current animation frame loop.
 */
function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  isAnimating = false;
}

/**
 * Reset the application state.
 */
function reset() {
  stopAnimation();
  particles = [];
  sourcePixels = [];
  targetAssignmentIndex = 0;
  fileInput.value = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (drawingMode) {
    drawingMode = false;
    drawingModeButton.setAttribute("aria-pressed", "false");
    drawingModeButton.textContent = "Drawing Mode";
  }

  updateControlStates();
}

/**
 * Toggle drawing mode and update button state.
 */
function toggleDrawingMode() {
  if (!targetPixelsSorted.length) {
    return;
  }

  drawingMode = !drawingMode;
  drawingModeButton.setAttribute("aria-pressed", String(drawingMode));
  drawingModeButton.textContent = drawingMode ? "Drawing Mode: On" : "Drawing Mode";

  if (drawingMode) {
    stopAnimation();
    particles = [];
    targetAssignmentIndex = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  updateControlStates();
}

/**
 * Handle drawing on the canvas to create particles manually.
 * @param {number} clientX
 * @param {number} clientY
 */
function handleDraw(clientX, clientY) {
  if (!drawingMode || !targetPixelsSorted.length) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);

  const brushSize = 4;
  for (let offsetX = -brushSize; offsetX <= brushSize; offsetX += 1) {
    for (let offsetY = -brushSize; offsetY <= brushSize; offsetY += 1) {
      const distance = Math.hypot(offsetX, offsetY);
      if (distance > brushSize) continue;

      const px = x + offsetX;
      const py = y + offsetY;

      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
      if (targetAssignmentIndex >= targetPixelsSorted.length) return;

      const target = targetPixelsSorted[targetAssignmentIndex];
      targetAssignmentIndex += 1;

      particles.push({
        currentX: px,
        currentY: py,
        targetX: target.x,
        targetY: target.y,
        color: "rgba(255, 255, 255, 1)",
      });
    }
  }

  updateControlStates();
  ensureAnimation();
}

// Event bindings
transformButton.addEventListener("click", () => {
  if (drawingMode) {
    ensureAnimation();
    return;
  }

  if (!sourcePixels.length || !targetPixelsSorted.length) return;

  stopAnimation();
  createParticleMapping();
  ensureAnimation();
});

resetButton.addEventListener("click", () => {
  reset();
});

drawingModeButton.addEventListener("click", toggleDrawingMode);

canvas.addEventListener("mousedown", (event) => {
  if (!drawingMode) return;
  isMouseDown = true;
  handleDraw(event.clientX, event.clientY);
});

canvas.addEventListener("mousemove", (event) => {
  if (!drawingMode || !isMouseDown) return;
  handleDraw(event.clientX, event.clientY);
});

window.addEventListener("mouseup", () => {
  isMouseDown = false;
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ({ target }) => {
    if (!target?.result) return;

    const image = new Image();
    image.onload = () => {
      stopAnimation();
      sourcePixels = getPixelDataFromImage(image, CANVAS_SIZE, CANVAS_SIZE).map((pixel) => ({
        ...pixel,
        originalX: pixel.x,
        originalY: pixel.y,
      }));
      displaySourceImage(image);
      drawingMode = false;
      drawingModeButton.setAttribute("aria-pressed", "false");
      drawingModeButton.textContent = "Drawing Mode";
      particles = [];
      targetAssignmentIndex = 0;
      updateControlStates();
    };
    image.src = target.result;
  };

  reader.readAsDataURL(file);
});

targetInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = ({ target }) => {
    if (!target?.result) return;

    const image = new Image();
    image.onload = () => {
      targetPixels = getPixelDataFromImage(image, CANVAS_SIZE, CANVAS_SIZE);
      targetPixelsSorted = [...targetPixels].sort((a, b) => a.brightness - b.brightness);
      targetAssignmentIndex = 0;
      particles = [];
      stopAnimation();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updateControlStates();
    };
    image.src = target.result;
  };

  reader.readAsDataURL(file);
});

function updateControlStates() {
  const hasTarget = targetPixelsSorted.length > 0;
  const hasSource = sourcePixels.length > 0;
  const hasDrawingParticles = particles.length > 0;
  const canTransformFromSource = hasTarget && hasSource && !drawingMode;
  const canTransformFromDrawing = hasTarget && drawingMode && hasDrawingParticles;

  transformButton.disabled = !(canTransformFromSource || canTransformFromDrawing);
  drawingModeButton.disabled = !hasTarget;
}

function initialize() {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  updateControlStates();
}

document.addEventListener("DOMContentLoaded", initialize);
