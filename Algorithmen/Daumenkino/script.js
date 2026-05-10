const FRAME_COUNT = 60;
const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 220;
const HIDDEN_FRAMES = 6;
const VISIBLE_FRAMES = FRAME_COUNT - HIDDEN_FRAMES;
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

function easeInSine(progress) {
  return 1 - Math.cos((progress * Math.PI) / 2);
}

function formatFrameNumber(value) {
  return String(value).padStart(2, "0");
}

function getProgress(index) {
  return FRAME_COUNT === 1 ? 0 : index / (FRAME_COUNT - 1);
}

function getFlightPoint(progress) {
  const framePosition = progress * (FRAME_COUNT - 1);
  const lastVisibleFrame = VISIBLE_FRAMES - 1;

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

function getFlightAngle(progress) {
  const delta = 0.01;
  const before = getFlightPoint(Math.max(progress - delta, 0));
  const after = getFlightPoint(Math.min(progress + delta, 1));
  return Math.atan2(after.y - before.y, after.x - before.x) * (180 / Math.PI);
}

function getSceneDescription(progress) {
  const framePosition = progress * (FRAME_COUNT - 1);
  const visibleProgress = (VISIBLE_FRAMES - 1) <= 0 ? 1 : Math.min(framePosition / (VISIBLE_FRAMES - 1), 1);

  if (framePosition >= VISIBLE_FRAMES) {
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

function createFrameSvg(index) {
  const progress = getProgress(index);
  const point = getFlightPoint(progress);
  const angle = getFlightAngle(progress) + 180;
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

function createFrameSource(index) {
  const svg = createFrameSvg(index);
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  frameObjectUrls.push(objectUrl);
  return objectUrl;
}

const frames = Array.from({ length: FRAME_COUNT }, (_, index) => {
  const progress = getProgress(index);

  return {
    id: index + 1,
    title: `Frame ${index + 1}`,
    description: getSceneDescription(progress),
    src: createFrameSource(index)
  };
});

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
const frameCountStat = document.getElementById("frameCountStat");

frameSlider.max = String(frames.length);

if (frameCountStat) {
  frameCountStat.textContent = String(frames.length);
}

function preloadFrames() {
  frames.forEach((frame) => {
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

  frameImage.src = frame.src;
  frameImage.alt = `${frame.title}: ${frame.description}`;
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

preloadFrames();
buildThumbnails();
render();