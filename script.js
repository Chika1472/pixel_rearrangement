const CANVAS_SIZE = 512;
const TIME_STEP = 0.016;
const ATTRACTION_STRENGTH = 0.45;
const PRESSURE_RADIUS = 6;
const PRESSURE_STIFFNESS = 0.08;
const VISCOSITY = 0.25;
const DRAG = 0.025;
const MAX_SPEED = 8;
const STOP_DISTANCE = 0.65;
const STOP_SPEED = 0.045;

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
    particles[i] = {
      currentX: src.x,
      currentY: src.y,
      targetX: tgt.x,
      targetY: tgt.y,
      color: src.color,
      velocityX: 0,
      velocityY: 0,
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

  const cellSize = PRESSURE_RADIUS;
  const invCellSize = 1 / cellSize;
  const grid = new Map();

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const cellX = Math.floor(particle.currentX * invCellSize);
    const cellY = Math.floor(particle.currentY * invCellSize);
    const key = `${cellX},${cellY}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }

    grid.get(key).push(i);
  }

  let particlesAtRest = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];

    const targetDx = particle.targetX - particle.currentX;
    const targetDy = particle.targetY - particle.currentY;

    let accelerationX = targetDx * ATTRACTION_STRENGTH;
    let accelerationY = targetDy * ATTRACTION_STRENGTH;

    const cellX = Math.floor(particle.currentX * invCellSize);
    const cellY = Math.floor(particle.currentY * invCellSize);

    for (let gx = cellX - 1; gx <= cellX + 1; gx += 1) {
      for (let gy = cellY - 1; gy <= cellY + 1; gy += 1) {
        const key = `${gx},${gy}`;
        const indices = grid.get(key);
        if (!indices) continue;

        for (let j = 0; j < indices.length; j += 1) {
          const neighborIndex = indices[j];
          if (neighborIndex === i) continue;

          const neighbor = particles[neighborIndex];
          const dx = particle.currentX - neighbor.currentX;
          const dy = particle.currentY - neighbor.currentY;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq === 0 || distanceSq > PRESSURE_RADIUS * PRESSURE_RADIUS) continue;

          const distance = Math.sqrt(distanceSq);
          const overlap = PRESSURE_RADIUS - distance;
          const nx = dx / distance;
          const ny = dy / distance;

          const repulsion = overlap * PRESSURE_STIFFNESS;
          accelerationX += nx * repulsion;
          accelerationY += ny * repulsion;

          const relativeVelocity =
            (particle.velocityX - neighbor.velocityX) * nx +
            (particle.velocityY - neighbor.velocityY) * ny;
          const viscosityImpulse = relativeVelocity * VISCOSITY;
          accelerationX -= viscosityImpulse * nx;
          accelerationY -= viscosityImpulse * ny;
        }
      }
    }

    particle.velocityX += accelerationX * TIME_STEP;
    particle.velocityY += accelerationY * TIME_STEP;

    particle.velocityX *= 1 - DRAG;
    particle.velocityY *= 1 - DRAG;

    const speed = Math.hypot(particle.velocityX, particle.velocityY);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      particle.velocityX *= scale;
      particle.velocityY *= scale;
    }

    particle.currentX += particle.velocityX * TIME_STEP;
    particle.currentY += particle.velocityY * TIME_STEP;

    particle.currentX = Math.min(Math.max(particle.currentX, 0), canvas.width - 1);
    particle.currentY = Math.min(Math.max(particle.currentY, 0), canvas.height - 1);

    if (
      Math.hypot(targetDx, targetDy) < STOP_DISTANCE &&
      Math.hypot(particle.velocityX, particle.velocityY) < STOP_SPEED
    ) {
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
        velocityX: 0,
        velocityY: 0,
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
      sourcePixels = getPixelDataFromImage(image, CANVAS_SIZE, CANVAS_SIZE);
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
