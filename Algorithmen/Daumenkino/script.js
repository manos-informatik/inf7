(() => {
  "use strict";

  const CANVAS_SIZE = 400;
  const RECORDING_DURATION_MS = 15000;
  const FRAME_INTERVAL_MS = 200;
  const TOTAL_FRAMES = 75;
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
  const previewContext = framePreview.getContext("2d", { willReadFrequently: true });
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
    playbackTimerId: null,
    previewRenderId: 0
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

  function loadFrameImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Frame konnte nicht geladen werden."));
      image.src = src;
    });
  }

  function drawImageDataToCanvas(image) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempContext = tempCanvas.getContext("2d", { willReadFrequently: true });
    tempContext.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    return tempContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  function getLuminance(data, offset) {
    return (data[offset] * 0.299) + (data[offset + 1] * 0.587) + (data[offset + 2] * 0.114);
  }

  function drawCurrentFrameChanges(previousImage, currentImage) {
    const diffCanvas = document.createElement("canvas");
    const previousData = drawImageDataToCanvas(previousImage).data;
    const currentImageData = drawImageDataToCanvas(currentImage);
    const currentData = currentImageData.data;

    diffCanvas.width = CANVAS_SIZE;
    diffCanvas.height = CANVAS_SIZE;
    const diffContext = diffCanvas.getContext("2d", { willReadFrequently: true });

    for (let offset = 0; offset < currentData.length; offset += 4) {
      const previousLuminance = getLuminance(previousData, offset);
      const currentLuminance = getLuminance(currentData, offset);
      const isNewDarkPixel = previousLuminance - currentLuminance > 8;

      if (!isNewDarkPixel) {
        currentData[offset + 3] = 0;
      }
    }

    diffContext.putImageData(currentImageData, 0, 0);
    previewContext.drawImage(diffCanvas, 0, 0);
  }

  async function renderPreview(index) {
    const renderId = state.previewRenderId;

    previewContext.fillStyle = "#ffffff";
    previewContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    try {
      const currentImage = await loadFrameImage(state.frames[index]);

      if (renderId !== state.previewRenderId) {
        return;
      }

      if (index === 0) {
        previewContext.drawImage(currentImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        return;
      }

      const previousImage = await loadFrameImage(state.frames[index - 1]);

      if (renderId !== state.previewRenderId) {
        return;
      }

      // Onion-Skinning: Der vorherige Stand wird blass, nur die neue Änderung kräftig gezeichnet.
      previewContext.globalAlpha = 0.24;
      previewContext.drawImage(previousImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      previewContext.globalAlpha = 1;
      drawCurrentFrameChanges(previousImage, currentImage);
    } catch (error) {
      if (renderId === state.previewRenderId) {
        previewPlaceholder.textContent = "Frame konnte nicht angezeigt werden";
        previewPlaceholder.style.display = "block";
      }
    } finally {
      previewContext.globalAlpha = 1;
    }
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
    state.previewRenderId += 1;

    if (state.frames.length === 0) {
      previewContext.fillStyle = "#ffffff";
      previewContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      framePreview.style.display = "none";
      previewPlaceholder.style.display = "block";
      previewPlaceholder.textContent = "Noch keine Bilder";
      frameSlider.value = "1";
      frameCounter.textContent = `Bild 0 / ${TOTAL_FRAMES}`;
      return;
    }

    state.currentFrameIndex = Math.min(Math.max(index, 0), state.frames.length - 1);
    framePreview.style.display = "block";
    previewPlaceholder.style.display = "none";
    frameSlider.value = String(state.currentFrameIndex + 1);
    frameCounter.textContent = `Bild ${state.currentFrameIndex + 1} / ${TOTAL_FRAMES}`;
    renderPreview(state.currentFrameIndex);
  }

  function finishRecording() {
    if (!state.isRecording) {
      return;
    }

    // Der 15-Sekunden-Abschluss ergänzt fehlende Frames, falls ein Intervall verzögert wurde.
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

    // Alle 0,2 Sekunden wird ein Bild gesichert; nach 15 Sekunden ist Schluss.
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

  frameSlider.max = String(TOTAL_FRAMES);

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
