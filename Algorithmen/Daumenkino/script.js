const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 220;
const SPACESHIP_FRAME_COUNT = 60;
const SPACESHIP_HIDDEN_FRAMES = 6;
const SPACESHIP_VISIBLE_FRAMES = SPACESHIP_FRAME_COUNT - SPACESHIP_HIDDEN_FRAMES;
const BALL_FRAME_COUNT = 48;
const frameObjectUrls = [];

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
        <linearGradient id="mist-${index}" x1="72" y1="26" x2="248" y2="172" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6BB8FF" stop-opacity="0.22"/>
          <stop offset="1" stop-color="#6BB8FF" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="plane-${index}" x1="-24" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F8FBFF"/>
          <stop offset="1" stop-color="#D7E4F3"/>
        </linearGradient>
        <filter id="blur-${index}" x="0" y="0" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="10"/>
        </filter>
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
  spaceship: {
    title: "Raumschiff",
    frames: buildSpaceshipFrames()
  },
  ball: {
    title: "Ball",
    frames: buildBallFrames()
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
const randomButton = document.getElementById("randomButton");
const sceneTitle = document.getElementById("sceneTitle");
const sceneDescription = document.getElementById("sceneDescription");
const statusPill = document.getElementById("statusPill");
const thumbnailStrip = document.getElementById("thumbnailStrip");
const galleryPrevButton = document.getElementById("galleryPrevButton");
const galleryNextButton = document.getElementById("galleryNextButton");
const playerTitle = document.getElementById("playerTitle");
const exampleButtons = Array.from(document.querySelectorAll(".example-card"));

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

function getActiveExample() {
  return EXAMPLES[activeExampleKey];
}

function setActiveExample(exampleKey) {
  if (!EXAMPLES[exampleKey]) {
    return;
  }

  setPlayback(false);
  activeExampleKey = exampleKey;
  frames = getActiveExample().frames;
  state.index = 0;
  playerTitle.textContent = getActiveExample().title;
  frameSlider.max = String(frames.length);

  exampleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.example === exampleKey);
  });

  buildThumbnails();
  render();
  centerActiveThumbnail("auto");
}

function syncPlaybackTimer() {
  clearPlaybackTimer();

  if (!state.playing) {
    return;
  }

  state.timerId = window.setInterval(() => {
    advanceFrame(1);
  }, Math.round(1000 / state.fps));
}

function setPlayback(playing) {
  state.playing = playing;
  syncPlaybackTimer();
  render();
}

function clampFrameIndex(index) {
  return Math.min(Math.max(index, 0), frames.length - 1);
}

function goToFrame(index, pausePlayback = true) {
  if (pausePlayback) {
    setPlayback(false);
  }

  state.index = clampFrameIndex(index);
  render();
}

function advanceFrame(step) {
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

function render() {
  const frame = frames[state.index];
  const progress = frames.length > 1 ? Math.round((state.index / (frames.length - 1)) * 100) : 0;
  const activeExample = getActiveExample();

  frameImage.src = frame.src;
  frameImage.alt = `${activeExample.title} ${frame.title}: ${frame.description}`;
  frameSlider.value = String(state.index + 1);
  frameLabel.textContent = `${frame.title} / ${frames.length}`;
  progressLabel.textContent = `${progress}%`;
  speedValue.textContent = `${state.fps} fps`;
  sceneTitle.textContent = frame.title;
  sceneDescription.textContent = frame.description;
  statusPill.textContent = state.playing ? "Läuft" : "Pausiert";
  statusPill.classList.toggle("playing", state.playing);
  playButton.textContent = state.playing ? "Pausieren" : "Abspielen";

  const thumbnailButtons = thumbnailStrip.querySelectorAll(".thumbnail-button");
  thumbnailButtons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === state.index);
  });

  if (galleryPrevButton && galleryNextButton) {
    galleryPrevButton.disabled = state.index === 0;
    galleryNextButton.disabled = state.index === frames.length - 1;
  }
}

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

randomButton.addEventListener("click", () => {
  const randomIndex = Math.floor(Math.random() * frames.length);
  goToFrame(randomIndex, true);
  centerActiveThumbnail("smooth");
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveExample(button.dataset.example);
  });
});

galleryPrevButton?.addEventListener("click", () => {
  goToFrame(state.index - 1, true);
  centerActiveThumbnail("smooth");
});

galleryNextButton?.addEventListener("click", () => {
  goToFrame(state.index + 1, true);
  centerActiveThumbnail("smooth");
});

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
setActiveExample(activeExampleKey);