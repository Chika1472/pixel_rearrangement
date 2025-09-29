const CANVAS_SIZE = 512;
const SPRING_STIFFNESS = 0.14;
const VISCOSITY = 0.18;
const FLOW_NOISE = 0.25;
const COLOR_EASING = 0.08;
const STOP_DISTANCE = 0.4;
const STOP_VELOCITY = 0.06;
const MIN_PARTICLE_RADIUS = 0.7;
const MAX_PARTICLE_RADIUS = 2.6;

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
 * @returns {Array<{
 *   x:number,
 *   y:number,
 *   color:{r:number, g:number, b:number, a:number},
 *   brightness:number
 * }>}
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
        color: { r, g, b, a: alpha },
        brightness: getBrightness(r, g, b),
      });
    }
  }

  return pixels;
}

/**
 * Prepare the particles array by mapping sorted source pixels to target pixels.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cloneColor(color) {
  return { r: color.r, g: color.g, b: color.b, a: color.a };
}

function colorToString({ r, g, b, a }) {
  const clampedR = Math.round(clamp(r, 0, 255));
  const clampedG = Math.round(clamp(g, 0, 255));
  const clampedB = Math.round(clamp(b, 0, 255));
  const clampedA = clamp(a, 0, 1);
  return `rgba(${clampedR}, ${clampedG}, ${clampedB}, ${clampedA.toFixed(3)})`;
}

function interpolateColors(startColor, endColor, t) {
  return {
    r: startColor.r + (endColor.r - startColor.r) * t,
    g: startColor.g + (endColor.g - startColor.g) * t,
    b: startColor.b + (endColor.b - startColor.b) * t,
    a: startColor.a + (endColor.a - startColor.a) * t,
  };
}

function createParticleMapping() {
  if (!sourcePixels.length || !targetPixelsSorted.length) return;

  const sortedSource = [...sourcePixels].sort((a, b) => a.brightness - b.brightness);
  const count = Math.min(sortedSource.length, targetPixelsSorted.length);

  particles = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const src = sortedSource[i];
    const tgt = targetPixelsSorted[i];
    const totalDistance = Math.hypot(tgt.x - src.x, tgt.y - src.y);

    particles[i] = {
      currentX: src.x,
      currentY: src.y,
      targetX: tgt.x,
      targetY: tgt.y,
      velocityX: 0,
      velocityY: 0,
      totalDistance,
      colorProgress: 0,
      sourceColor: cloneColor(src.color),
      targetColor: cloneColor(tgt.color),
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

    particle.velocityX += dx * SPRING_STIFFNESS;
    particle.velocityY += dy * SPRING_STIFFNESS;

    const noiseStrength = (1 - particle.colorProgress) * FLOW_NOISE;
    if (noiseStrength > 0) {
      particle.velocityX += (Math.random() - 0.5) * noiseStrength;
      particle.velocityY += (Math.random() - 0.5) * noiseStrength;
    }

    particle.velocityX *= 1 - VISCOSITY;
    particle.velocityY *= 1 - VISCOSITY;

    particle.currentX += particle.velocityX;
    particle.currentY += particle.velocityY;

    const remainingX = particle.targetX - particle.currentX;
    const remainingY = particle.targetY - particle.currentY;
    const remainingDistance = Math.hypot(remainingX, remainingY);
    const speed = Math.hypot(particle.velocityX, particle.velocityY);
    const targetProgress =
      particle.totalDistance === 0
        ? 1
        : 1 - Math.min(1, remainingDistance / particle.totalDistance);
    particle.colorProgress += (targetProgress - particle.colorProgress) * COLOR_EASING;

    const blendedColor = interpolateColors(
      particle.sourceColor,
      particle.targetColor,
      particle.colorProgress
    );
    const radius =
      MIN_PARTICLE_RADIUS +
      (1 - particle.colorProgress) * (MAX_PARTICLE_RADIUS - MIN_PARTICLE_RADIUS);
    const alpha = 0.45 + particle.colorProgress * 0.55;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${(1 - particle.colorProgress) * 1.4}px)`;
    ctx.fillStyle = colorToString(blendedColor);
    ctx.beginPath();
    ctx.arc(particle.currentX, particle.currentY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (
      remainingDistance < STOP_DISTANCE &&
      speed < STOP_VELOCITY &&
      particle.colorProgress > 0.98
    ) {
      particlesAtRest += 1;
    }
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
        velocityX: 0,
        velocityY: 0,
        totalDistance: Math.hypot(target.x - px, target.y - py),
        colorProgress: 0,
        sourceColor: { r: 255, g: 255, b: 255, a: 1 },
        targetColor: cloneColor(target.color),
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
