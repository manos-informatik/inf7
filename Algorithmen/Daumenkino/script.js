(() => {
  "use strict";

  const CANVAS_SIZE = 400;
  const RECORDING_DURATION_MS = 10000;
  const FRAME_INTERVAL_MS = 200;
  const TOTAL_FRAMES = 50;
  const LINE_WIDTH = 4;

  const canvas = document.querySelector("#drawingCanvas");
  const context = canvas.getContext("2d");
  const startButton = document.querySelector("#startButton");
  const resetButton = document.querySelector("#resetButton");
  const prevButton = document.querySelector("#prevButton");
  const nextButton = document.querySelector("#nextButton");
  const playButton = document.querySelector("#playButton");
  const frameSlider = document.querySelector("#frameSlider");
  const frameCounter = document.querySelector("#frameCounter");
  const framePreview = document.querySelector("#framePreview");
  const previewPlaceholder = document.querySelector("#previewPlaceholder");
  const recordingStatus = document.querySelector("#recordingStatus");

  const state = {
    frames: [],
    currentFrameIndex: 0,
    isRecording: false,
    isDrawing: false,
    recordingStartedAt: 0,
    captureTimerId: null,
    countdownTimerId: null,
    stopTimerId: null,
    playbackTimerId: null
  };

  function clearCanvas() {
    // Ein weißer Hintergrund macht die gespeicherten Data-URLs zuverlässig sichtbar.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    context.strokeStyle = "#000000";
    context.lineWidth = LINE_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";
  }

  function clearRecordingTimers() {
    window.clearInterval(state.captureTimerId);
    window.clearInterval(state.countdownTimerId);
    window.clearTimeout(state.stopTimerId);
    state.captureTimerId = null;
    state.countdownTimerId = null;
    state.stopTimerId = null;
  }

  function stopPlayback() {
    window.clearInterval(state.playbackTimerId);
    state.playbackTimerId = null;
    playButton.textContent = "Abspielen";
  }

  function captureFrame() {
    if (state.frames.length >= TOTAL_FRAMES) {
      return;
    }

    state.frames.push(canvas.toDataURL("image/png"));
  }

  function updateRecordingStatus() {
    const elapsed = Date.now() - state.recordingStartedAt;
    const remainingMs = Math.max(0, RECORDING_DURATION_MS - elapsed);
    const remainingSeconds = (remainingMs / 1000).toFixed(1).replace(".", ",");
    recordingStatus.textContent = `Aufnahme läuft: ${remainingSeconds} s`;
  }

  function updateControls() {
    const hasFrames = state.frames.length === TOTAL_FRAMES;
    const isPlaying = state.playbackTimerId !== null;

    startButton.disabled = state.isRecording;
    prevButton.disabled = !hasFrames || state.isRecording;
    nextButton.disabled = !hasFrames || state.isRecording;
    playButton.disabled = !hasFrames || state.isRecording;
    frameSlider.disabled = !hasFrames || state.isRecording;
    playButton.textContent = isPlaying ? "Pause" : "Abspielen";
    canvas.classList.toggle("recording", state.isRecording);
  }

  function showFrame(index) {
    if (state.frames.length === 0) {
      framePreview.removeAttribute("src");
      framePreview.style.display = "none";
      previewPlaceholder.style.display = "block";
      frameSlider.value = "1";
      frameCounter.textContent = `Bild 0 / ${TOTAL_FRAMES}`;
      return;
    }

    state.currentFrameIndex = Math.min(Math.max(index, 0), state.frames.length - 1);
    framePreview.src = state.frames[state.currentFrameIndex];
    framePreview.style.display = "block";
    previewPlaceholder.style.display = "none";
    frameSlider.value = String(state.currentFrameIndex + 1);
    frameCounter.textContent = `Bild ${state.currentFrameIndex + 1} / ${TOTAL_FRAMES}`;
  }

  function finishRecording() {
    if (!state.isRecording) {
      return;
    }

    // Der 10-Sekunden-Abschluss ergänzt fehlende Frames, falls ein Intervall verzögert wurde.
    while (state.frames.length < TOTAL_FRAMES) {
      captureFrame();
    }

    state.isRecording = false;
    state.isDrawing = false;
    clearRecordingTimers();
    state.currentFrameIndex = 0;
    recordingStatus.textContent = `${TOTAL_FRAMES} Bilder aufgenommen`;
    showFrame(0);
    updateControls();
  }

  function handleCaptureTick() {
    if (!state.isRecording) {
      return;
    }

    captureFrame();

    if (state.frames.length >= TOTAL_FRAMES) {
      finishRecording();
    }
  }

  function startRecording() {
    if (state.isRecording) {
      return;
    }

    stopPlayback();
    clearRecordingTimers();
    state.frames = [];
    state.currentFrameIndex = 0;
    state.isRecording = true;
    state.isDrawing = false;
    state.recordingStartedAt = Date.now();
    clearCanvas();
    showFrame(0);
    updateRecordingStatus();
    updateControls();

    // Alle 0,2 Sekunden wird ein Bild gesichert; nach 10 Sekunden ist Schluss.
    state.captureTimerId = window.setInterval(handleCaptureTick, FRAME_INTERVAL_MS);
    state.countdownTimerId = window.setInterval(updateRecordingStatus, 100);
    state.stopTimerId = window.setTimeout(finishRecording, RECORDING_DURATION_MS);
  }

  function resetApp() {
    clearRecordingTimers();
    stopPlayback();
    state.frames = [];
    state.currentFrameIndex = 0;
    state.isRecording = false;
    state.isDrawing = false;
    recordingStatus.textContent = "Bereit";
    clearCanvas();
    showFrame(0);
    updateControls();
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function beginDrawing(event) {
    if (!state.isRecording) {
      return;
    }

    const point = getCanvasPoint(event);
    state.isDrawing = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function draw(event) {
    if (!state.isRecording || !state.isDrawing) {
      return;
    }

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endDrawing() {
    if (!state.isDrawing) {
      return;
    }

    state.isDrawing = false;
    context.closePath();
  }

  function showPreviousFrame() {
    stopPlayback();
    showFrame(state.currentFrameIndex - 1);
    updateControls();
  }

  function showNextFrame() {
    stopPlayback();
    showFrame(state.currentFrameIndex + 1);
    updateControls();
  }

  function startPlayback() {
    if (state.frames.length !== TOTAL_FRAMES) {
      return;
    }

    playButton.textContent = "Pause";
    state.playbackTimerId = window.setInterval(() => {
      const nextIndex = state.currentFrameIndex + 1;

      // Wiederholen ist hier didaktisch sinnvoll, weil die Bewegung als Schleife leichter erkennbar wird.
      showFrame(nextIndex >= state.frames.length ? 0 : nextIndex);
    }, FRAME_INTERVAL_MS);
  }

  function togglePlayback() {
    if (state.playbackTimerId !== null) {
      stopPlayback();
      return;
    }

    startPlayback();
  }

  startButton.addEventListener("click", startRecording);
  resetButton.addEventListener("click", resetApp);
  prevButton.addEventListener("click", showPreviousFrame);
  nextButton.addEventListener("click", showNextFrame);
  playButton.addEventListener("click", togglePlayback);

  frameSlider.addEventListener("input", () => {
    stopPlayback();
    showFrame(Number(frameSlider.value) - 1);
    updateControls();
  });

  canvas.addEventListener("mousedown", beginDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseleave", endDrawing);
  window.addEventListener("mouseup", endDrawing);

  resetApp();
})();
