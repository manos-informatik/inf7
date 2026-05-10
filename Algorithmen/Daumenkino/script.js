const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 220;
const SPACESHIP_FRAME_COUNT = 60;
const SPACESHIP_HIDDEN_FRAMES = 6;
const SPACESHIP_VISIBLE_FRAMES = SPACESHIP_FRAME_COUNT - SPACESHIP_HIDDEN_FRAMES;
const BALL_FRAME_COUNT = 48;
const ONION_SKIN_ALPHA = 0.25;
const GIF_LZW_MIN_CODE_SIZE = 8;
const GIF_LITERAL_RUN_LENGTH = 200;
const CUSTOM_TOOLS = {
  ink: { color: "#111827", width: 6 },
  blue: { color: "#2563eb", width: 6 },
  orange: { color: "#f97316", width: 6 },
  erase: { erase: true, width: 18 }
};
const frameObjectUrls = [];

const customState = {
  savedFrames: [],
  tool: "ink",
  drawing: false,
  pointerId: null,
  lastPoint: null,
  previousFrameCanvas: null,
  previousFrameSrc: null,
  hasDraft: false,
  exportingGif: false
};

const starField = [
  { x: 58, y: 42, radius: 2.2, color: "#E8F1FF", opacity: 0.82 },
  { x: 94, y: 68, radius: 1.7, color: "#FFB454", opacity: 0.8 },
  { x: 132, y: 48, radius: 1.9, color: "#E8F1FF", opacity: 0.74 },
  { x: 170, y: 84, radius: 2.0, color: "#6BB8FF", opacity: 0.9 },
  { x: 214, y: 60, radius: 1.8, color: "#E8F1FF", opacity: 0.76 },
  { x: 248, y: 90, radius: 2.1, color: "#FFB454", opacity: 0.78 },
  { x: 278, y: 118, radius: 1.9, color: "#E8F1FF", opacity: 0.72 }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function interpolate(start, end, progress) {
  return start + (end - start) * progress;
}

function formatFrameNumber(value) {
  return String(value).padStart(2, "0");
}

function getProgress(index, frameCount) {
  return frameCount === 1 ? 0 : index / (frameCount - 1);
}

function createFrameSource(svg) {
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  frameObjectUrls.push(objectUrl);
  return objectUrl;
}

// A fixed 3-3-2 palette keeps GIF export small and dependency-free for these simple drawings.
function createGifPalette() {
  const palette = new Uint8Array(256 * 3);

  for (let index = 0; index < 256; index += 1) {
    const redLevel = (index >> 5) & 0x07;
    const greenLevel = (index >> 2) & 0x07;
    const blueLevel = index & 0x03;
    const offset = index * 3;

    palette[offset] = Math.round((redLevel / 7) * 255);
    palette[offset + 1] = Math.round((greenLevel / 7) * 255);
    palette[offset + 2] = Math.round((blueLevel / 3) * 255);
  }

  return palette;
}

const GIF_PALETTE = createGifPalette();

function quantizeGifColor(red, green, blue) {
  return (red & 0xE0) | ((green & 0xE0) >> 3) | (blue >> 6);
}

function canvasToGifIndices(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true }) || canvas.getContext("2d");
  const pixels = context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
  const indices = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);

  for (let pixelOffset = 0, pixelIndex = 0; pixelOffset < pixels.length; pixelOffset += 4, pixelIndex += 1) {
    const alpha = pixels[pixelOffset + 3];

    if (alpha < 128) {
      indices[pixelIndex] = 255;
      continue;
    }

    indices[pixelIndex] = quantizeGifColor(
      pixels[pixelOffset],
      pixels[pixelOffset + 1],
      pixels[pixelOffset + 2]
    );
  }

  return indices;
}

function lzwEncodeGif(indices, minCodeSize = GIF_LZW_MIN_CODE_SIZE) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const bytes = [];
  let codeSize = minCodeSize + 1;
  let bitBuffer = 0;
  let bitCount = 0;

  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;

    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xFF);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  for (let offset = 0; offset < indices.length; offset += GIF_LITERAL_RUN_LENGTH) {
    const chunkLength = Math.min(GIF_LITERAL_RUN_LENGTH, indices.length - offset);
    codeSize = minCodeSize + 1;
    writeCode(clearCode);

    for (let index = 0; index < chunkLength; index += 1) {
      writeCode(indices[offset + index]);
    }
  }

  codeSize = minCodeSize + 1;
  writeCode(endCode);

  if (bitCount > 0) {
    bytes.push(bitBuffer & 0xFF);
  }

  return new Uint8Array(bytes);
}

function appendGifSubBlocks(target, data) {
  for (let offset = 0; offset < data.length; offset += 255) {
    const chunkSize = Math.min(255, data.length - offset);
    target.push(chunkSize);

    for (let index = 0; index < chunkSize; index += 1) {
      target.push(data[offset + index]);
    }
  }

  target.push(0x00);
}

function createAnimatedGifBlob(frameCanvases, frameDelayCs, shouldLoop) {
  const bytes = [];
  const pushByte = (value) => {
    bytes.push(value & 0xFF);
  };
  const pushWord = (value) => {
    pushByte(value);
    pushByte(value >> 8);
  };
  const pushText = (value) => {
    for (let index = 0; index < value.length; index += 1) {
      pushByte(value.charCodeAt(index));
    }
  };

  pushText("GIF89a");
  pushWord(FRAME_WIDTH);
  pushWord(FRAME_HEIGHT);
  pushByte(0xF7);
  pushByte(255);
  pushByte(0x00);

  for (const value of GIF_PALETTE) {
    pushByte(value);
  }

  if (shouldLoop) {
    pushByte(0x21);
    pushByte(0xFF);
    pushByte(0x0B);
    pushText("NETSCAPE2.0");
    pushByte(0x03);
    pushByte(0x01);
    pushWord(0);
    pushByte(0x00);
  }

  for (const frameCanvas of frameCanvases) {
    const indices = canvasToGifIndices(frameCanvas);
    const imageData = lzwEncodeGif(indices);

    pushByte(0x21);
    pushByte(0xF9);
    pushByte(0x04);
    pushByte(0x00);
    pushWord(frameDelayCs);
    pushByte(0x00);
    pushByte(0x00);

    pushByte(0x2C);
    pushWord(0);
    pushWord(0);
    pushWord(FRAME_WIDTH);
    pushWord(FRAME_HEIGHT);
    pushByte(0x00);

    pushByte(GIF_LZW_MIN_CODE_SIZE);
    appendGifSubBlocks(bytes, imageData);
  }

  pushByte(0x3B);

  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = src;
  });
}

async function getCustomFrameCanvas(frame) {
  if (frame.canvas) {
    return frame.canvas;
  }

  const image = await loadImage(frame.src);
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  frame.canvas = canvas;
  return canvas;
}

function createCustomPlaceholderSvg() {
  return `
    <svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" rx="28" fill="#F3F6FA"/>
      <rect x="18" y="18" width="284" height="184" rx="22" fill="#FFFFFF" stroke="#D7E1EA" stroke-width="2"/>
      <path d="M40 172H280" stroke="#CBD5E1" stroke-width="2.5" stroke-linecap="round"/>
      <text x="160" y="106" fill="#6B7B8C" font-family="Avenir Next, Trebuchet MS, sans-serif" font-size="18" font-weight="700" text-anchor="middle">Noch kein Frame</text>
      <text x="160" y="130" fill="#91A0AF" font-family="Avenir Next, Trebuchet MS, sans-serif" font-size="13" text-anchor="middle">Zeichne rechts und speichere deinen ersten Frame.</text>
    </svg>
  `;
}

const CUSTOM_EMPTY_FRAME_SRC = createFrameSource(createCustomPlaceholderSvg());

function getSpaceshipPoint(progress) {
  const framePosition = progress * (SPACESHIP_FRAME_COUNT - 1);
  const lastVisibleFrame = SPACESHIP_VISIBLE_FRAMES - 1;

  if (framePosition <= lastVisibleFrame) {
    const localProgress = lastVisibleFrame <= 0 ? 1 : framePosition / lastVisibleFrame;
    const yProgress = Math.pow(localProgress, 1.35);
    return {
      x: 160 + Math.sin(localProgress * Math.PI * 1.08 - 0.42) * 14,
      y: interpolate(244, -54, yProgress)
    };
  }

  return {
    x: 170,
    y: -54
  };
}

function getSpaceshipAngle(progress) {
  const delta = 0.01;
  const before = getSpaceshipPoint(Math.max(progress - delta, 0));
  const after = getSpaceshipPoint(Math.min(progress + delta, 1));
  return Math.atan2(after.y - before.y, after.x - before.x) * (180 / Math.PI);
}

function getSpaceshipDescription(progress) {
  const framePosition = progress * (SPACESHIP_FRAME_COUNT - 1);
  const visibleProgress = (SPACESHIP_VISIBLE_FRAMES - 1) <= 0 ? 1 : Math.min(framePosition / (SPACESHIP_VISIBLE_FRAMES - 1), 1);

  if (framePosition >= SPACESHIP_VISIBLE_FRAMES) {
    return "Jetzt ist das Raumschiff komplett außerhalb des Bildes, bevor der nächste Zyklus unten wieder beginnt.";
  }

  if (visibleProgress < 0.18) {
    return "Das Raumschiff erscheint nur ganz langsam wieder am unteren Bildschirmrand.";
  }

  if (visibleProgress < 0.42) {
    return "Nach dem Wiedereintritt steigt das Raumschiff ruhig und fast senkrecht nach oben.";
  }

  if (visibleProgress < 0.82) {
    return "In der Bildmitte bleibt der Aufstieg stabil und die Spitze zeigt in die Flugrichtung.";
  }

  return "Kurz vor dem oberen Rand verlässt das Raumschiff das Bild vollständig.";
}

function renderStars() {
  return starField
    .map((star) => `<circle cx="${star.x}" cy="${star.y}" r="${star.radius}" fill="${star.color}" fill-opacity="${star.opacity}"/>`)
    .join("");
}

function createSpaceshipFrameSvg(index) {
  const progress = getProgress(index, SPACESHIP_FRAME_COUNT);
  const point = getSpaceshipPoint(progress);
  const angle = getSpaceshipAngle(progress) + 180;
  const frameNumber = formatFrameNumber(index + 1);
  const sunY = 56;

  return `
    <svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-${index}" x1="24" y1="20" x2="294" y2="204" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0F1A27"/>
          <stop offset="0.56" stop-color="#122133"/>
          <stop offset="1" stop-color="#09131D"/>
        </linearGradient>
        <linearGradient id="plane-${index}" x1="-24" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F8FBFF"/>
          <stop offset="1" stop-color="#D7E4F3"/>
        </linearGradient>
      </defs>

      <rect width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" rx="28" fill="url(#bg-${index})"/>
      <rect x="18" y="18" width="284" height="184" rx="22" fill="#102031" stroke="#253D55" stroke-width="2"/>
      <circle cx="258" cy="${sunY}" r="24" fill="#FFB454" fill-opacity="0.17"/>
      ${renderStars()}
      <path d="M40 70H280" stroke="#37536A" stroke-opacity="0.65" stroke-dasharray="6 8"/>
      <path d="M40 110H280" stroke="#37536A" stroke-opacity="0.45" stroke-dasharray="6 8"/>
      <path d="M40 150H280" stroke="#37536A" stroke-opacity="0.45" stroke-dasharray="6 8"/>
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="18" fill="#6BB8FF" fill-opacity="0.08"/>
      <g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${angle.toFixed(2)})">
        <path d="M-24 0L24 -12L0 0L24 12L-24 0Z" fill="url(#plane-${index})" stroke="#E8F1FF" stroke-width="2" stroke-linejoin="round"/>
        <path d="M0 0L24 -12" stroke="#91A6BC" stroke-width="2"/>
        <path d="M0 0L24 12" stroke="#91A6BC" stroke-width="2"/>
        <path d="M-8 -3L8 0L-8 3" stroke="#8EB8DE" stroke-width="2" stroke-linecap="round"/>
      </g>
      <text x="24" y="193" fill="#91A6BC" font-family="Avenir Next, Trebuchet MS, sans-serif" font-size="13" font-weight="700">Frame ${frameNumber}</text>
    </svg>
  `;
}

function buildSpaceshipFrames() {
  return Array.from({ length: SPACESHIP_FRAME_COUNT }, (_, index) => {
    const progress = getProgress(index, SPACESHIP_FRAME_COUNT);

    return {
      id: index + 1,
      title: `Frame ${index + 1}`,
      description: getSpaceshipDescription(progress),
      src: createFrameSource(createSpaceshipFrameSvg(index))
    };
  });
}

function getBallPhase(index) {
  return index / BALL_FRAME_COUNT;
}

function getBallBounce(phase) {
  return Math.max(0, Math.sin(phase * Math.PI));
}

function getBallDescription(phase) {
  if (phase < 0.14 || phase > 0.88) {
    return "Der Ball berührt fast die weiße Fläche und startet direkt in den nächsten Sprung.";
  }

  if (phase < 0.5) {
    return "Der Ball springt von der weißen Fläche nach oben.";
  }

  return "Der Ball fällt wieder sauber auf die weiße Fläche zurück.";
}

function createBallFrameSvg(index) {
  const phase = getBallPhase(index);
  const bounce = getBallBounce(phase);
  const squash = 1 - bounce;
  const radius = 22;
  const floorY = 172;
  const centerX = 160;
  const centerY = floorY - radius - Math.pow(bounce, 1.7) * 94;
  const scaleX = 1 + squash * 0.12;
  const scaleY = 1 - squash * 0.12;
  const frameNumber = formatFrameNumber(index + 1);

  return `
    <svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" rx="28" fill="#F3F6FA"/>
      <rect x="18" y="18" width="284" height="184" rx="22" fill="#FFFFFF" stroke="#D7E1EA" stroke-width="2"/>
      <path d="M38 172H282" stroke="#CBD5E1" stroke-width="2.5" stroke-linecap="round"/>
      <g transform="translate(${centerX} ${centerY.toFixed(1)}) scale(${scaleX.toFixed(3)} ${scaleY.toFixed(3)})">
        <circle r="${radius}" fill="none" stroke="#111827" stroke-width="5"/>
      </g>
      <text x="24" y="193" fill="#6B7B8C" font-family="Avenir Next, Trebuchet MS, sans-serif" font-size="13" font-weight="700">Frame ${frameNumber}</text>
    </svg>
  `;
}

function buildBallFrames() {
  return Array.from({ length: BALL_FRAME_COUNT }, (_, index) => {
    const phase = getBallPhase(index);

    return {
      id: index + 1,
      title: `Frame ${index + 1}`,
      description: getBallDescription(phase),
      src: createFrameSource(createBallFrameSvg(index))
    };
  });
}

const EXAMPLES = {
  ball: {
    title: "Ball",
    frames: buildBallFrames()
  },
  spaceship: {
    title: "Raumschiff",
    frames: buildSpaceshipFrames()
  },
  custom: {
    title: "Eigenes Daumenkino",
    getFrames: () => customState.savedFrames
  }
};

let activeExampleKey = "ball";
let frames = EXAMPLES[activeExampleKey].frames;

const state = {
  index: 0,
  playing: false,
  fps: 8,
  loop: true,
  timerId: null
};

const frameImage = document.getElementById("frameImage");
const frameSlider = document.getElementById("frameSlider");
const frameLabel = document.getElementById("frameLabel");
const progressLabel = document.getElementById("progressLabel");
const playButton = document.getElementById("playButton");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const loopToggle = document.getElementById("loopToggle");
const statusPill = document.getElementById("statusPill");
const thumbnailStrip = document.getElementById("thumbnailStrip");
const galleryPrevButton = document.getElementById("galleryPrevButton");
const galleryNextButton = document.getElementById("galleryNextButton");
const playerTitle = document.getElementById("playerTitle");
const exampleButtons = Array.from(document.querySelectorAll(".example-card"));
const customEditorCard = document.getElementById("customEditorCard");
const customFrameCount = document.getElementById("customFrameCount");
const customEditorHint = document.getElementById("customEditorHint");
const saveCustomFrameButton = document.getElementById("saveCustomFrameButton");
const downloadCustomGifButton = document.getElementById("downloadCustomGifButton");
const clearCustomFrameButton = document.getElementById("clearCustomFrameButton");
const resetCustomFramesButton = document.getElementById("resetCustomFramesButton");
const onionCanvas = document.getElementById("onionCanvas");
const drawCanvas = document.getElementById("drawCanvas");
const toolButtons = Array.from(document.querySelectorAll(".tool-button"));

const onionContext = onionCanvas.getContext("2d");
const drawContext = drawCanvas.getContext("2d", { willReadFrequently: true });

function preloadFrames(frameList) {
  frameList.forEach((frame) => {
    const image = new Image();
    image.src = frame.src;
  });
}

function clearPlaybackTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function centerActiveThumbnail(behavior = "smooth") {
  const activeThumbnail = thumbnailStrip.querySelector(`.thumbnail-button[data-index="${state.index}"]`);
  activeThumbnail?.scrollIntoView({ behavior, inline: "center", block: "nearest" });
}

function resolveFrames(exampleKey) {
  const example = EXAMPLES[exampleKey];
  if (!example) {
    return [];
  }

  return typeof example.getFrames === "function" ? example.getFrames() : example.frames;
}

function getActiveExample() {
  return EXAMPLES[activeExampleKey];
}

function canvasHasContent() {
  const pixels = drawContext.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) {
      return true;
    }
  }

  return false;
}

function updateToolButtons() {
  toolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === customState.tool);
  });
}

function updateOnionSkin() {
  onionContext.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

  if (!customState.previousFrameCanvas) {
    return;
  }

  onionContext.globalAlpha = ONION_SKIN_ALPHA;
  onionContext.drawImage(customState.previousFrameCanvas, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  onionContext.globalAlpha = 1;
}

function updateCustomEditorUi() {
  const customActive = activeExampleKey === "custom";
  const savedCount = customState.savedFrames.length;
  const hasSavedFrames = savedCount > 0;
  customState.hasDraft = canvasHasContent();

  customEditorCard.hidden = !customActive;
  customFrameCount.textContent = `${savedCount} ${savedCount === 1 ? "Frame" : "Frames"}`;
  saveCustomFrameButton.disabled = !customState.hasDraft || customState.exportingGif;
  downloadCustomGifButton.disabled = !hasSavedFrames || customState.exportingGif;
  downloadCustomGifButton.textContent = customState.exportingGif ? "GIF wird erstellt..." : "Als GIF herunterladen";
  clearCustomFrameButton.disabled = !customState.hasDraft || customState.exportingGif;
  resetCustomFramesButton.disabled = (savedCount === 0 && !customState.hasDraft) || customState.exportingGif;

  if (savedCount === 0) {
    customEditorHint.textContent = "Noch kein Frame gespeichert. Zeichne deinen ersten Frame und speichere ihn ab.";
  } else {
    customEditorHint.textContent = "Der letzte gespeicherte Frame erscheint mit 25% Transparenz im Hintergrund des neuen Frames. Deine gespeicherten Frames kannst du auch als GIF herunterladen.";
  }

  updateToolButtons();
  updateOnionSkin();
}

function setupDrawingSurface() {
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  drawContext.imageSmoothingEnabled = true;
}

function configureDrawingTool() {
  const tool = CUSTOM_TOOLS[customState.tool];

  if (tool.erase) {
    drawContext.globalCompositeOperation = "destination-out";
    drawContext.strokeStyle = "rgba(0, 0, 0, 1)";
    drawContext.lineWidth = tool.width;
  } else {
    drawContext.globalCompositeOperation = "source-over";
    drawContext.strokeStyle = tool.color;
    drawContext.lineWidth = tool.width;
  }
}

function getCanvasPoint(event) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function drawSegment(fromPoint, toPoint) {
  configureDrawingTool();
  drawContext.beginPath();
  drawContext.moveTo(fromPoint.x, fromPoint.y);
  drawContext.lineTo(toPoint.x, toPoint.y);
  drawContext.stroke();
}

function clearDraftCanvas(shouldRefreshUi = true) {
  drawContext.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  customState.hasDraft = false;

  if (shouldRefreshUi) {
    updateCustomEditorUi();
  }
}

function refreshFramesAfterCustomChange(jumpToLastFrame = false) {
  frames = resolveFrames(activeExampleKey);
  frameSlider.max = String(Math.max(frames.length, 1));

  if (frames.length === 0) {
    state.index = 0;
  } else if (jumpToLastFrame) {
    state.index = frames.length - 1;
  } else {
    state.index = clamp(state.index, 0, frames.length - 1);
  }

  buildThumbnails();
  render();
  centerActiveThumbnail(jumpToLastFrame ? "smooth" : "auto");
}

function saveCustomFrame() {
  if (!canvasHasContent()) {
    updateCustomEditorUi();
    return;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = FRAME_WIDTH;
  exportCanvas.height = FRAME_HEIGHT;
  const exportContext = exportCanvas.getContext("2d");
  const frameNumber = customState.savedFrames.length + 1;

  exportContext.fillStyle = "#FFFFFF";
  exportContext.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  exportContext.drawImage(drawCanvas, 0, 0);

  const src = exportCanvas.toDataURL("image/png");
  const frame = {
    id: frameNumber,
    title: `Frame ${frameNumber}`,
    description: `Selbst gezeichneter Frame ${frameNumber}.`,
    canvas: exportCanvas,
    src
  };

  customState.savedFrames.push(frame);
  customState.previousFrameCanvas = exportCanvas;
  customState.previousFrameSrc = src;
  clearDraftCanvas(false);
  updateCustomEditorUi();

  if (activeExampleKey === "custom") {
    refreshFramesAfterCustomChange(true);
  }
}

async function downloadCustomGif() {
  if (customState.savedFrames.length === 0 || customState.exportingGif) {
    return;
  }

  customState.exportingGif = true;
  updateCustomEditorUi();

  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const frameCanvases = await Promise.all(customState.savedFrames.map((frame) => getCustomFrameCanvas(frame)));
    const frameDelayCs = Math.max(2, Math.round(100 / state.fps));
    const gifBlob = createAnimatedGifBlob(frameCanvases, frameDelayCs, state.loop);
    const downloadUrl = URL.createObjectURL(gifBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `daumenkino-${Date.now()}.gif`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  } catch (error) {
    console.error(error);
  } finally {
    customState.exportingGif = false;
    updateCustomEditorUi();
  }
}

function resetCustomFrames() {
  clearPlaybackTimer();
  state.playing = false;
  customState.savedFrames = [];
  customState.previousFrameCanvas = null;
  customState.previousFrameSrc = null;
  customState.drawing = false;
  customState.pointerId = null;
  customState.lastPoint = null;
  clearDraftCanvas(false);

  if (activeExampleKey === "custom") {
    refreshFramesAfterCustomChange(false);
    return;
  }

  updateCustomEditorUi();
}

function startDrawing(event) {
  if (activeExampleKey !== "custom") {
    return;
  }

  event.preventDefault();
  drawCanvas.setPointerCapture(event.pointerId);
  customState.drawing = true;
  customState.pointerId = event.pointerId;
  customState.lastPoint = getCanvasPoint(event);
  drawSegment(customState.lastPoint, customState.lastPoint);
  customState.hasDraft = true;
  updateCustomEditorUi();
}

function continueDrawing(event) {
  if (!customState.drawing || event.pointerId !== customState.pointerId) {
    return;
  }

  event.preventDefault();
  const nextPoint = getCanvasPoint(event);
  drawSegment(customState.lastPoint, nextPoint);
  customState.lastPoint = nextPoint;
  customState.hasDraft = true;
}

function stopDrawing(event) {
  if (!customState.drawing) {
    return;
  }

  if (event.pointerId !== undefined && customState.pointerId !== null && event.pointerId !== customState.pointerId) {
    return;
  }

  customState.drawing = false;
  customState.pointerId = null;
  customState.lastPoint = null;
  updateCustomEditorUi();
}

function syncPlaybackTimer() {
  clearPlaybackTimer();

  if (!state.playing || frames.length <= 1) {
    return;
  }

  state.timerId = window.setInterval(() => {
    advanceFrame(1);
  }, Math.round(1000 / state.fps));
}

function setPlayback(playing) {
  state.playing = playing && frames.length > 1;
  syncPlaybackTimer();
  render();
}

function clampFrameIndex(index) {
  if (frames.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), frames.length - 1);
}

function goToFrame(index, pausePlayback = true) {
  if (frames.length === 0) {
    return;
  }

  if (pausePlayback) {
    setPlayback(false);
  }

  state.index = clampFrameIndex(index);
  render();
}

function advanceFrame(step) {
  if (frames.length <= 1) {
    return;
  }

  let nextIndex = state.index + step;

  if (nextIndex >= frames.length) {
    if (state.loop) {
      nextIndex = 0;
    } else {
      nextIndex = frames.length - 1;
      setPlayback(false);
      state.index = nextIndex;
      render();
      return;
    }
  }

  if (nextIndex < 0) {
    nextIndex = state.loop ? frames.length - 1 : 0;
  }

  state.index = nextIndex;
  render();
}

function buildThumbnails() {
  thumbnailStrip.innerHTML = "";

  if (frames.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "thumbnail-empty";
    emptyState.textContent = "Speichere deinen ersten Frame, dann erscheint er hier in der Galerie.";
    thumbnailStrip.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  frames.forEach((frame, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumbnail-button";
    button.dataset.index = String(index);
    button.innerHTML = `
      <img src="${frame.src}" alt="Vorschaubild ${frame.title}" loading="lazy">
      <strong>${frame.title}</strong>
      <span>${index + 1}/${frames.length}</span>
    `;
    button.addEventListener("click", () => {
      goToFrame(index, true);
      centerActiveThumbnail("smooth");
    });
    fragment.appendChild(button);
  });

  thumbnailStrip.appendChild(fragment);
  centerActiveThumbnail("auto");
}

function updateNavigationState() {
  const hasFrames = frames.length > 0;
  const canStep = frames.length > 1;

  frameSlider.disabled = !hasFrames;
  playButton.disabled = !canStep;
  prevButton.disabled = !hasFrames || state.index === 0;
  nextButton.disabled = !hasFrames || state.index === frames.length - 1;
  galleryPrevButton.disabled = !hasFrames || state.index === 0;
  galleryNextButton.disabled = !hasFrames || state.index === frames.length - 1;
}

function render() {
  const activeExample = getActiveExample();
  const hasFrames = frames.length > 0;

  statusPill.textContent = state.playing ? "Läuft" : "Pausiert";
  statusPill.classList.toggle("playing", state.playing);
  playButton.textContent = state.playing ? "Pausieren" : "Abspielen";
  playerTitle.textContent = activeExample.title;
  speedValue.textContent = `${state.fps} fps`;

  if (!hasFrames) {
    frameImage.src = CUSTOM_EMPTY_FRAME_SRC;
    frameImage.alt = `${activeExample.title}: Noch kein Frame gespeichert.`;
    frameSlider.max = "1";
    frameSlider.value = "1";
    frameLabel.textContent = "Noch kein Frame";
    progressLabel.textContent = "-";
    updateNavigationState();
    updateCustomEditorUi();
    return;
  }

  const frame = frames[state.index];
  const progress = frames.length > 1 ? Math.round((state.index / (frames.length - 1)) * 100) : 0;

  frameImage.src = frame.src;
  frameImage.alt = `${activeExample.title} ${frame.title}: ${frame.description}`;
  frameSlider.max = String(frames.length);
  frameSlider.value = String(state.index + 1);
  frameLabel.textContent = `${frame.title} / ${frames.length}`;
  progressLabel.textContent = `${progress}%`;

  const thumbnailButtons = thumbnailStrip.querySelectorAll(".thumbnail-button");
  thumbnailButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === state.index);
  });

  updateNavigationState();
  updateCustomEditorUi();
}

function setActiveExample(exampleKey) {
  if (!EXAMPLES[exampleKey]) {
    return;
  }

  clearPlaybackTimer();
  state.playing = false;
  activeExampleKey = exampleKey;
  frames = resolveFrames(exampleKey);
  state.index = 0;

  exampleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.example === exampleKey);
  });

  buildThumbnails();
  render();
  centerActiveThumbnail("auto");
}

setupDrawingSurface();

playButton.addEventListener("click", () => {
  setPlayback(!state.playing);
});

prevButton.addEventListener("click", () => {
  goToFrame(state.index - 1, true);
  centerActiveThumbnail("smooth");
});

nextButton.addEventListener("click", () => {
  goToFrame(state.index + 1, true);
  centerActiveThumbnail("smooth");
});

frameSlider.addEventListener("input", (event) => {
  const nextIndex = Number.parseInt(event.target.value, 10) - 1;
  goToFrame(nextIndex, true);
  centerActiveThumbnail("smooth");
});

speedSlider.addEventListener("input", (event) => {
  state.fps = Number.parseInt(event.target.value, 10);
  syncPlaybackTimer();
  render();
});

loopToggle.addEventListener("change", (event) => {
  state.loop = event.target.checked;
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveExample(button.dataset.example);
  });
});

galleryPrevButton.addEventListener("click", () => {
  goToFrame(state.index - 1, true);
  centerActiveThumbnail("smooth");
});

galleryNextButton.addEventListener("click", () => {
  goToFrame(state.index + 1, true);
  centerActiveThumbnail("smooth");
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    customState.tool = button.dataset.tool;
    updateCustomEditorUi();
  });
});

saveCustomFrameButton.addEventListener("click", () => {
  saveCustomFrame();
});

downloadCustomGifButton.addEventListener("click", () => {
  downloadCustomGif();
});

clearCustomFrameButton.addEventListener("click", () => {
  clearDraftCanvas();
});

resetCustomFramesButton.addEventListener("click", () => {
  resetCustomFrames();
});

drawCanvas.addEventListener("pointerdown", startDrawing);
drawCanvas.addEventListener("pointermove", continueDrawing);
drawCanvas.addEventListener("pointerup", stopDrawing);
drawCanvas.addEventListener("pointerleave", stopDrawing);
drawCanvas.addEventListener("pointercancel", stopDrawing);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.playing) {
    setPlayback(false);
  }
});

window.addEventListener("beforeunload", () => {
  clearPlaybackTimer();
  frameObjectUrls.forEach((objectUrl) => {
    URL.revokeObjectURL(objectUrl);
  });
});

preloadFrames(EXAMPLES.ball.frames);
preloadFrames(EXAMPLES.spaceship.frames);
updateCustomEditorUi();
setActiveExample(activeExampleKey);