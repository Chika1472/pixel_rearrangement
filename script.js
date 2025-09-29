const state = {
  sourceBitmap: null,
  targetBitmap: null,
  sourceName: "",
  targetName: "",
=======
  resolution: 96,
  scale: 6,
  duration: 6,
  particles: [],
  playing: false,
  progress: 0,
  animationFrame: null,
  startTimestamp: null,
};

const BIN_RES = 12;
const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const resolutionSlider = document.getElementById("resolution");
const resolutionValue = document.getElementById("resolutionValue");
const durationSlider = document.getElementById("duration");
const durationValue = document.getElementById("durationValue");
const scaleSlider = document.getElementById("scale");
const scaleValue = document.getElementById("scaleValue");
const playPauseButton = document.getElementById("playPause");
const progressSlider = document.getElementById("progress");
const sourceInput = document.getElementById("sourceInput");
const targetInput = document.getElementById("targetInput");

const SAMPLE_SOURCE = createSVGDataURL(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f44336" />
        <stop offset="0.5" stop-color="#ffeb3b" />
        <stop offset="1" stop-color="#4caf50" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" fill="url(#g1)" />
    <circle cx="48" cy="48" r="32" fill="#2196f3" opacity="0.8" />
    <rect x="96" y="96" width="48" height="48" fill="#9c27b0" opacity="0.7" />
  </svg>
`);

const SAMPLE_TARGET = createSVGDataURL(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <defs>
      <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#00c6ff" />
        <stop offset="1" stop-color="#0072ff" />
      </linearGradient>
    </defs>
    <rect width="160" height="160" fill="url(#g2)" />
    <g opacity="0.85">
      <polygon points="20,140 80,20 140,140" fill="#ff9800" />
      <circle cx="80" cy="96" r="28" fill="#ff4081" />
    </g>
  </svg>
`);

window.addEventListener("load", () => {
  setupInputs();
  updateLabels();
  loadSampleImages();
});

function setupInputs() {
  const handleSourceFile = async (file) => {
    if (!file) return;
    try {
      state.sourceBitmap = await decodeImageFromFile(file);
      state.sourceName = file.name ?? "";
      updateFileLabel(sourceInput, state.sourceName);
      await processIfReady();
    } catch (error) {
      reportError(error);
    }
  };

  const handleTargetFile = async (file) => {
    if (!file) return;
    try {
      state.targetBitmap = await decodeImageFromFile(file);
      state.targetName = file.name ?? "";
      updateFileLabel(targetInput, state.targetName);
      await processIfReady();
    } catch (error) {
      reportError(error);
    }
  };

  sourceInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleSourceFile(file);
    event.target.value = "";
  });

  targetInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleTargetFile(file);
    event.target.value = "";
  });

  addDropZone(sourceInput, handleSourceFile);
  addDropZone(targetInput, handleTargetFile);
=======
  sourceInput.addEventListener("change", async (event) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    state.sourceBitmap = await decodeImageFromFile(file);
    await processIfReady();
  });

  targetInput.addEventListener("change", async (event) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    state.targetBitmap = await decodeImageFromFile(file);
    await processIfReady();
  });

  addDropZone(sourceInput, (file) => sourceInput.files = fileListFromFile(file));
  addDropZone(targetInput, (file) => targetInput.files = fileListFromFile(file));

  resolutionSlider.addEventListener("input", () => {
    state.resolution = Number(resolutionSlider.value);
    updateLabels();
  });

  resolutionSlider.addEventListener("change", () => processIfReady());

  durationSlider.addEventListener("input", () => {
    state.duration = Number(durationSlider.value);
    updateLabels();
    if (state.playing) {
      state.startTimestamp = performance.now() - state.progress * state.duration * 1000;
    }
  });

  scaleSlider.addEventListener("input", () => {
    state.scale = Number(scaleSlider.value);
    updateLabels();
    resizeCanvas();
    drawFrame(state.progress);
  });

  playPauseButton.addEventListener("click", () => {
    if (!state.particles.length) return;
    state.playing = !state.playing;
    if (state.playing) {
      if (state.progress >= 1) {
        state.progress = 0;
        progressSlider.value = "0";
        drawFrame(0);
      }
      playPauseButton.textContent = "Pause";
      state.startTimestamp = performance.now() - state.progress * state.duration * 1000;
      startAnimationLoop();
    } else {
      playPauseButton.textContent = "Play";
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }
  });

  progressSlider.addEventListener("input", () => {
    if (!state.particles.length) return;
    state.progress = Number(progressSlider.value) / Number(progressSlider.max);
    drawFrame(state.progress);
  });
}

function updateLabels() {
  resolutionValue.textContent = `${state.resolution}×${state.resolution}`;
  durationValue.textContent = `${state.duration} s`;
  scaleValue.textContent = `${state.scale} px`;
}

function addDropZone(input, onDropFile) {
  const label = input.closest("label");
  if (!label) return;
  label.addEventListener("dragover", (event) => {
    event.preventDefault();
    label.classList.add("dragging");
  });
  label.addEventListener("dragleave", () => label.classList.remove("dragging"));
  label.addEventListener("drop", (event) => {
    event.preventDefault();
    label.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      input.value = "";
      onDropFile(file);
=======
      onDropFile(file);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function createSVGDataURL(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function decodeImageFromFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return decodeImageFromURL(dataUrl);
}

async function decodeImageFromURL(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(img);
    } catch (error) {
      console.warn("createImageBitmap failed, falling back to Image", error);
    }
  }
  return img;
=======
  return createImageBitmap(img);
}

function fileListFromFile(file) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  return dataTransfer.files;
}

async function processIfReady() {
  if (!state.sourceBitmap || !state.targetBitmap) return;
  statusEl.textContent = "Processing…";
  statusEl.classList.remove("hidden");
  state.playing = false;
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  state.startTimestamp = null;
  playPauseButton.textContent = "Play";
  await new Promise((resolve) => setTimeout(resolve, 20));
  const resolution = state.resolution;
  const sourceData = await sampleBitmap(state.sourceBitmap, resolution);
  const targetData = await sampleBitmap(state.targetBitmap, resolution);
  const mapping = computePixelMapping(sourceData, targetData, resolution, resolution);
  state.particles = mapping;
  state.progress = 0;
  playPauseButton.disabled = false;
  playPauseButton.textContent = "Play";
  progressSlider.value = "0";
  progressSlider.disabled = false;
  resizeCanvas();
  statusEl.textContent = "";
  statusEl.classList.add("hidden");
  drawFrame(0);
}

function updateFileLabel(input, name) {
  const label = input.closest("label");
  if (!label) return;
  const nameEl = label.querySelector(".selected-name");
  if (nameEl) {
    nameEl.textContent = name ?? "";
  }
}

function reportError(error) {
  console.error(error);
  statusEl.textContent =
    "Something went wrong while loading the image. Please try another file.";
  statusEl.classList.remove("hidden");
}

=======
async function sampleBitmap(bitmap, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const { width: bmpWidth, height: bmpHeight } = getBitmapDimensions(bitmap);
  const scale = Math.max(size / bmpWidth, size / bmpHeight);
  const width = Math.round(bmpWidth * scale);
  const height = Math.round(bmpHeight * scale);
=======
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const offsetX = (size - width) / 2;
  const offsetY = (size - height) / 2;
  ctx.drawImage(bitmap, offsetX, offsetY, width, height);
  const imageData = ctx.getImageData(0, 0, size, size);
  return imageData;
}

function getBitmapDimensions(bitmap) {
  if (typeof bitmap.width === "number" && typeof bitmap.height === "number") {
    if (bitmap.width > 0 && bitmap.height > 0) {
      return { width: bitmap.width, height: bitmap.height };
    }
  }
  if (
    "naturalWidth" in bitmap &&
    typeof bitmap.naturalWidth === "number" &&
    bitmap.naturalWidth > 0
  ) {
    return { width: bitmap.naturalWidth, height: bitmap.naturalHeight };
  }
  return { width: 1, height: 1 };
}

=======
function computePixelMapping(sourceData, targetData, width, height) {
  const total = width * height;
  const buckets = createBuckets();
  const particles = new Array(total);
  const used = new Uint8Array(total);
  let fallbackCursor = 0;

  const takeNextAvailable = () => {
    while (fallbackCursor < total && used[fallbackCursor]) {
      fallbackCursor++;
    }
    if (fallbackCursor >= total) return null;
    const idx = fallbackCursor;
    used[idx] = 1;
    fallbackCursor++;
    return idx;
  };

  const sourceLabs = new Array(total);
  const sourceColors = new Array(total);
  for (let i = 0; i < total; i++) {
    const r = sourceData.data[i * 4 + 0];
    const g = sourceData.data[i * 4 + 1];
    const b = sourceData.data[i * 4 + 2];
    const a = sourceData.data[i * 4 + 3];
    const lab = rgbToLab(r, g, b);
    sourceLabs[i] = lab;
    sourceColors[i] = [r, g, b, a];
    const [lIdx, aIdx, bIdx] = quantizeLab(lab);
    buckets[lIdx][aIdx][bIdx].push(i);
  }

  for (let i = 0; i < total; i++) {
    const r = targetData.data[i * 4 + 0];
    const g = targetData.data[i * 4 + 1];
    const b = targetData.data[i * 4 + 2];
    const targetLab = rgbToLab(r, g, b);
    const [lIdx, aIdx, bIdx] = quantizeLab(targetLab);
    const matchIndex = findClosestPixel(
      buckets,
      sourceLabs,
      used,
      targetLab,
      lIdx,
      aIdx,
      bIdx
    );
    const sourceIndex = matchIndex ?? takeNextAvailable();
    if (sourceIndex === null || sourceIndex === undefined) continue;
    used[sourceIndex] = 1;
    const sx = sourceIndex % width;
    const sy = Math.floor(sourceIndex / width);
    const tx = i % width;
    const ty = Math.floor(i / width);
    particles[sourceIndex] = {
      color: sourceColors[sourceIndex],
      colorStyle: rgbaString(sourceColors[sourceIndex]),
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
    };
  }

  // Compact to remove undefined slots, preserving color ownership
  return particles.filter(Boolean);
}

function findClosestPixel(
  buckets,
  sourceLabs,
  used,
  targetLab,
  lIdx,
  aIdx,
  bIdx
) {
  const maxRadius = BIN_RES;
  for (let radius = 0; radius <= maxRadius; radius++) {
    let candidateIndex = null;
    let candidateDistance = Infinity;
    let candidateBucket = null;
    let candidatePosition = -1;
    const lStart = Math.max(0, lIdx - radius);
    const lEnd = Math.min(BIN_RES - 1, lIdx + radius);
    const aStart = Math.max(0, aIdx - radius);
    const aEnd = Math.min(BIN_RES - 1, aIdx + radius);
    const bStart = Math.max(0, bIdx - radius);
    const bEnd = Math.min(BIN_RES - 1, bIdx + radius);
    for (let li = lStart; li <= lEnd; li++) {
      for (let ai = aStart; ai <= aEnd; ai++) {
        for (let bi = bStart; bi <= bEnd; bi++) {
          const bucket = buckets[li][ai][bi];
          if (!bucket.length) continue;
          for (let k = bucket.length - 1; k >= 0; k--) {
            const index = bucket[k];
            if (used[index]) {
              bucket.splice(k, 1);
              continue;
            }
            const dist = labDistanceSquared(targetLab, sourceLabs[index]);
            if (dist < candidateDistance) {
              candidateDistance = dist;
              candidateIndex = index;
              candidateBucket = bucket;
              candidatePosition = k;
            }
          }
        }
      }
    }
    if (candidateIndex !== null && candidateBucket) {
      candidateBucket.splice(candidatePosition, 1);
      used[candidateIndex] = 1;
      return candidateIndex;
    }
  }
  return null;
}

function createBuckets() {
  return Array.from({ length: BIN_RES }, () =>
    Array.from({ length: BIN_RES }, () =>
      Array.from({ length: BIN_RES }, () => [])
    )
  );
}

function quantizeLab([l, a, b]) {
  const lIdx = clamp(Math.floor((l / 100) * BIN_RES), 0, BIN_RES - 1);
  const aIdx = clamp(Math.floor(((a + 128) / 256) * BIN_RES), 0, BIN_RES - 1);
  const bIdx = clamp(Math.floor(((b + 128) / 256) * BIN_RES), 0, BIN_RES - 1);
  return [lIdx, aIdx, bIdx];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function rgbToXyz(r, g, b) {
  const srgbToLinear = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
  return [X, Y, Z];
}

function xyzToLab(x, y, z) {
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const f = (t) => {
    const delta = 6 / 29;
    return t > Math.pow(delta, 3)
      ? Math.cbrt(t)
      : t / (3 * Math.pow(delta, 2)) + 4 / 29;
  };

  const fx = f(x / Xn);
  const fy = f(y / Yn);
  const fz = f(z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

function labDistanceSquared(a, b) {
  const dL = a[0] - b[0];
  const dA = a[1] - b[1];
  const dB = a[2] - b[2];
  return dL * dL + dA * dA + dB * dB;
}

function rgbaString([r, g, b, a]) {
  const alpha = a / 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function resizeCanvas() {
  const size = state.resolution * state.scale;
  canvas.width = size;
  canvas.height = size;
}

function drawFrame(progress) {
  if (!state.particles.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const scale = state.scale;
  const eased = easeInOutCubic(progress);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const particle of state.particles) {
    const x = (particle.sourceX + (particle.targetX - particle.sourceX) * eased) * scale;
    const y = (particle.sourceY + (particle.targetY - particle.sourceY) * eased) * scale;
    ctx.fillStyle = particle.colorStyle;
    ctx.fillRect(Math.round(x), Math.round(y), scale, scale);
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function startAnimationLoop() {
  const durationMs = state.duration * 1000;
  const step = (timestamp) => {
    if (!state.playing) return;
    if (state.startTimestamp === null) {
      state.startTimestamp = timestamp;
    }
    const elapsed = timestamp - state.startTimestamp;
    state.progress = Math.min(1, elapsed / durationMs);
    drawFrame(state.progress);
    progressSlider.value = String(Math.floor(state.progress * Number(progressSlider.max)));
    if (state.progress >= 1) {
      state.playing = false;
      playPauseButton.textContent = "Replay";
      state.startTimestamp = null;
      state.animationFrame = null;
      return;
    }
    state.animationFrame = requestAnimationFrame(step);
  };
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(step);
}

async function loadSampleImages() {
  state.sourceBitmap = await decodeImageFromURL(SAMPLE_SOURCE);
  state.targetBitmap = await decodeImageFromURL(SAMPLE_TARGET);
  state.sourceName = "Sample gradient";
  state.targetName = "Sample shapes";
  updateFileLabel(sourceInput, state.sourceName);
  updateFileLabel(targetInput, state.targetName);
=======
  await processIfReady();
}
