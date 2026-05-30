(() => {
  "use strict";

  const DRAW_INTERVAL_MS = 520;
  const DRAW_CHECK_DELAY_MS = 150;
  const DRAW_POINT_DELAY_MS = 310;
  const MAX_CANVAS_SIZE = 400;
  const NEUTRAL_RGB = [226, 232, 240];
  const SETUP_STEPS = [
    { delay: 1000, action: "highlightSize" },
    { delay: 2400, action: "applySizeAndHighlightBackground" },
    { delay: 3800, action: "applyBackgroundAndHighlightStroke" },
    { delay: 5200, action: "finishSetup" }
  ];

  const elements = {
    canvasBoard: document.querySelector(".canvas-board"),
    canvasViewport: document.querySelector(".canvas-viewport"),
    canvasStack: document.querySelector("#canvasStack"),
    drawingCanvas: document.querySelector("#drawingCanvas"),
    gridCanvas: document.querySelector("#gridCanvas"),
    startButton: document.querySelector("#startButton"),
    resetButton: document.querySelector("#resetButton"),
    drawCounter: document.querySelector("#drawCounter"),
    runStatus: document.querySelector("#runStatus"),
    mousePressedToken: document.querySelector("#mousePressedToken"),
    pointArguments: document.querySelector("#pointArguments"),
    drawBlock: document.querySelector("#drawBlock"),
    codeLines: Array.from(document.querySelectorAll(".code-line")),
    lineSetup: document.querySelector("#lineSetup"),
    lineSize: document.querySelector("#lineSize"),
    lineBackground: document.querySelector("#lineBackground"),
    lineStroke: document.querySelector("#lineStroke"),
    lineDraw: document.querySelector("#lineDraw"),
    lineIf: document.querySelector("#lineIf"),
    linePoint: document.querySelector("#linePoint"),
    strokePreviewDot: document.querySelector("#strokePreviewDot"),
    inputs: Array.from(document.querySelectorAll(".code-input")),
    sizeWidth: document.querySelector("#sizeWidth"),
    sizeHeight: document.querySelector("#sizeHeight"),
    backgroundR: document.querySelector("#backgroundR"),
    backgroundG: document.querySelector("#backgroundG"),
    backgroundB: document.querySelector("#backgroundB"),
    strokeWeight: document.querySelector("#strokeWeight")
  };

  const drawingContext = elements.drawingCanvas.getContext("2d");
  const gridContext = elements.gridCanvas.getContext("2d");

  const state = {
    animationFrameId: null,
    setupTimeoutIds: new Set(),
    drawStepTimeoutIds: new Set(),
    runToken: 0,
    isSetupRunning: false,
    isDrawRunning: false,
    drawCount: 0,
    lastDrawTimestamp: 0,
    mouseInside: false,
    mousePressed: false,
    mousePosition: null,
    strokeWeight: 10,
    backgroundRgb: [255, 255, 255],
    canvasWidth: 400,
    canvasHeight: 400,
    displayScale: 1
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rgbText(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function resizeCodeInput(input) {
    const length = Math.max(2, input.value.length);
    input.style.width = `${length + 1}ch`;
  }

  function normalizeInput(input, commit) {
    const min = Number(input.dataset.min);
    const max = Number(input.dataset.max);
    const fallback = Number(input.dataset.fallback);
    let rawValue = input.value.replace(/\D/g, "");

    if (rawValue !== input.value) {
      input.value = rawValue;
    }

    if (rawValue !== "" && Number(rawValue) > max) {
      rawValue = String(max);
      input.value = rawValue;
    }

    if (commit) {
      const value = rawValue === "" ? fallback : Number(rawValue);
      input.value = String(clamp(value, min, max));
    }

    resizeCodeInput(input);
  }

  function readInputNumber(input) {
    const min = Number(input.dataset.min);
    const max = Number(input.dataset.max);
    const fallback = Number(input.dataset.fallback);
    const rawValue = input.value.replace(/\D/g, "");
    const value = rawValue === "" ? fallback : Number(rawValue);

    return clamp(value, min, max);
  }

  function readSettings(commitInputs) {
    if (commitInputs) {
      elements.inputs.forEach((input) => normalizeInput(input, true));
    }

    return {
      width: readInputNumber(elements.sizeWidth),
      height: readInputNumber(elements.sizeHeight),
      backgroundRgb: [
        readInputNumber(elements.backgroundR),
        readInputNumber(elements.backgroundG),
        readInputNumber(elements.backgroundB)
      ],
      strokeWeight: readInputNumber(elements.strokeWeight)
    };
  }

  function clearDrawingLayer() {
    drawingContext.clearRect(0, 0, elements.drawingCanvas.width, elements.drawingCanvas.height);
  }

  function backgroundLuminance(rgb) {
    return (rgb[0] * 0.299) + (rgb[1] * 0.587) + (rgb[2] * 0.114);
  }

  function drawLine(context, x1, y1, x2, y2) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  function drawGrid() {
    const width = elements.gridCanvas.width;
    const height = elements.gridCanvas.height;
    const isDarkBackground = backgroundLuminance(state.backgroundRgb) < 128;
    const gridColor = isDarkBackground ? "rgba(226, 232, 240, 0.24)" : "rgba(15, 23, 42, 0.16)";
    const axisColor = isDarkBackground ? "rgba(226, 232, 240, 0.42)" : "rgba(15, 23, 42, 0.34)";
    const labelColor = isDarkBackground ? "rgba(241, 245, 249, 0.82)" : "rgba(15, 23, 42, 0.7)";

    gridContext.clearRect(0, 0, width, height);
    gridContext.lineWidth = 1;
    gridContext.strokeStyle = gridColor;

    for (let x = 0; x < width; x += 10) {
      drawLine(gridContext, x + 0.5, 0, x + 0.5, height);
    }

    for (let y = 0; y < height; y += 10) {
      drawLine(gridContext, 0, y + 0.5, width, y + 0.5);
    }

    gridContext.strokeStyle = axisColor;
    drawLine(gridContext, 0.5, 0, 0.5, height);
    drawLine(gridContext, 0, 0.5, width, 0.5);

    if (width >= 50 && height >= 22) {
      gridContext.font = "10px Consolas, 'Courier New', monospace";
      gridContext.fillStyle = labelColor;
      gridContext.fillText("(0,0)", 4, 13);
    }
  }

  function setCanvasSize(width, height) {
    state.canvasWidth = width;
    state.canvasHeight = height;

    [elements.drawingCanvas, elements.gridCanvas].forEach((canvas) => {
      canvas.width = width;
      canvas.height = height;
    });

    clearDrawingLayer();
    drawGrid();
    updateCanvasDisplaySize();
  }

  function setCanvasBackground(rgb) {
    state.backgroundRgb = [...rgb];
    elements.canvasStack.style.backgroundColor = rgbText(rgb);
    drawGrid();
  }

  function getMaximumCanvasDisplayScale() {
    if (window.innerWidth >= 1800 && window.innerHeight >= 950) {
      return 1.6;
    }

    if (window.innerWidth >= 1320 && window.innerHeight >= 800) {
      return 1.35;
    }

    return 1;
  }

  function updateCanvasDisplaySize() {
    const boardStyles = window.getComputedStyle(elements.canvasBoard);
    const horizontalPadding = parseFloat(boardStyles.paddingLeft) + parseFloat(boardStyles.paddingRight);
    const availableWidth = Math.max(160, elements.canvasBoard.clientWidth - horizontalPadding);
    const boardTop = elements.canvasBoard.getBoundingClientRect().top;
    const availableHeight = Math.max(180, window.innerHeight - boardTop - 120);
    const scale = Math.min(
      getMaximumCanvasDisplayScale(),
      availableWidth / MAX_CANVAS_SIZE,
      availableHeight / MAX_CANVAS_SIZE
    );
    const viewportSize = Math.round(MAX_CANVAS_SIZE * scale);
    const displayWidth = Math.max(1, Math.round(state.canvasWidth * scale));
    const displayHeight = Math.max(1, Math.round(state.canvasHeight * scale));

    state.displayScale = scale;
    elements.canvasViewport.style.width = `${viewportSize}px`;
    elements.canvasViewport.style.height = `${viewportSize}px`;
    elements.canvasStack.style.width = `${displayWidth}px`;
    elements.canvasStack.style.height = `${displayHeight}px`;

    [elements.drawingCanvas, elements.gridCanvas].forEach((canvas) => {
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    });
  }

  function clearActiveCode() {
    clearDrawStepHighlights();
    elements.codeLines.forEach((line) => line.classList.remove("is-active"));
    elements.drawBlock.classList.remove("is-running");
  }

  function highlightLine(line) {
    clearActiveCode();
    line.classList.add("is-active");
  }

  function highlightDrawLoop() {
    clearActiveCode();
    elements.drawBlock.classList.add("is-running");
  }

  function updateDrawCounter() {
    elements.drawCounter.textContent = String(state.drawCount);
  }

  function updateMouseDisplay() {
    const showCoordinates = state.mouseInside && state.mousePosition !== null;
    const showMousePressed = state.mousePressed && state.mouseInside;

    elements.mousePressedToken.classList.toggle("is-active", showMousePressed);
    elements.mousePressedToken.classList.toggle("is-inactive", !showMousePressed);

    if (showCoordinates) {
      elements.pointArguments.textContent = `${state.mousePosition.x},${state.mousePosition.y}`;
      elements.pointArguments.classList.add("has-coordinates");
    } else {
      elements.pointArguments.textContent = "mouseX,mouseY";
      elements.pointArguments.classList.remove("has-coordinates");
    }
  }

  function updateControls() {
    const isBusy = state.isSetupRunning || state.isDrawRunning;

    elements.startButton.disabled = isBusy;
    elements.canvasStack.classList.toggle("is-ready", state.isDrawRunning);
  }

  function clearSetupTimeouts() {
    state.setupTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    state.setupTimeoutIds.clear();
  }

  function clearDrawStepTimeouts() {
    state.drawStepTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    state.drawStepTimeoutIds.clear();
  }

  function clearDrawStepHighlights() {
    [elements.lineDraw, elements.lineIf, elements.linePoint].forEach((line) => {
      line.classList.remove("is-draw-call", "is-draw-check", "is-draw-action");
    });
  }

  function scheduleDrawStep(token, delay, callback) {
    const timeoutId = window.setTimeout(() => {
      state.drawStepTimeoutIds.delete(timeoutId);

      if (state.runToken === token && state.isDrawRunning) {
        callback();
      }
    }, delay);

    state.drawStepTimeoutIds.add(timeoutId);
  }

  function stopDrawLoop() {
    if (state.animationFrameId !== null) {
      window.cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }

    clearDrawStepTimeouts();
    clearDrawStepHighlights();
    state.isDrawRunning = false;
    state.lastDrawTimestamp = 0;
  }

  function drawPoint(x, y) {
    // Processing zeichnet point() mit der aktuellen strokeWeight-Einstellung.
    drawingContext.fillStyle = "#000000";
    drawingContext.beginPath();
    drawingContext.arc(x, y, state.strokeWeight / 2, 0, Math.PI * 2);
    drawingContext.fill();
  }

  function showDrawStep(line, className) {
    clearDrawStepHighlights();
    line.classList.add(className);
  }

  function showDrawCycle(token) {
    clearDrawStepTimeouts();
    showDrawStep(elements.lineDraw, "is-draw-call");

    scheduleDrawStep(token, DRAW_CHECK_DELAY_MS, () => {
      showDrawStep(elements.lineIf, "is-draw-check");
    });

    scheduleDrawStep(token, DRAW_POINT_DELAY_MS, () => {
      const canDraw = state.mousePressed && state.mouseInside && state.mousePosition !== null;

      if (!canDraw) {
        showDrawStep(elements.lineIf, "is-draw-check");
        return;
      }

      showDrawStep(elements.linePoint, "is-draw-action");
      drawPoint(state.mousePosition.x, state.mousePosition.y);
    });
  }

  function runDrawLoop(token, timestamp) {
    if (!state.isDrawRunning || state.runToken !== token) {
      state.animationFrameId = null;
      return;
    }

    if (state.lastDrawTimestamp === 0 || timestamp - state.lastDrawTimestamp >= DRAW_INTERVAL_MS) {
      state.lastDrawTimestamp = timestamp;
      state.drawCount += 1;
      updateDrawCounter();
      showDrawCycle(token);
    }

    state.animationFrameId = window.requestAnimationFrame((nextTimestamp) => {
      runDrawLoop(token, nextTimestamp);
    });
  }

  function startDrawLoop(token) {
    if (state.animationFrameId !== null) {
      return;
    }

    state.animationFrameId = window.requestAnimationFrame((timestamp) => {
      runDrawLoop(token, timestamp);
    });
  }

  function scheduleSetupStep(token, delay, callback) {
    const timeoutId = window.setTimeout(() => {
      state.setupTimeoutIds.delete(timeoutId);

      if (state.runToken === token && state.isSetupRunning) {
        callback();
      }
    }, delay);

    state.setupTimeoutIds.add(timeoutId);
  }

  function prepareNeutralCanvas() {
    const settings = readSettings(false);

    setCanvasBackground(settings.backgroundRgb);
    setCanvasSize(settings.width, settings.height);
    updateStrokePreview(settings.strokeWeight);
  }

  function updateStrokePreview(strokeWeight) {
    elements.strokePreviewDot.style.width = `${strokeWeight}px`;
    elements.strokePreviewDot.style.height = `${strokeWeight}px`;
  }

  function stopSimulationForCodeChange() {
    state.runToken += 1;
    clearSetupTimeouts();
    stopDrawLoop();

    state.isSetupRunning = false;
    state.drawCount = 0;
    state.mouseInside = false;
    state.mousePressed = false;
    state.mousePosition = null;

    clearActiveCode();
    updateDrawCounter();
    updateMouseDisplay();
    updateControls();
    elements.runStatus.textContent = "Bereit";
  }

  function resetSimulation() {
    state.runToken += 1;
    clearSetupTimeouts();
    stopDrawLoop();

    state.isSetupRunning = false;
    state.drawCount = 0;
    state.mouseInside = false;
    state.mousePressed = false;
    state.mousePosition = null;
    state.strokeWeight = readInputNumber(elements.strokeWeight);

    readSettings(true);
    prepareNeutralCanvas();
    clearActiveCode();
    updateDrawCounter();
    updateMouseDisplay();
    updateControls();
    elements.runStatus.textContent = "Bereit";
  }

  function completeSetup(token, settings) {
    if (state.runToken !== token || !state.isSetupRunning) {
      return;
    }

    state.strokeWeight = settings.strokeWeight;
    updateStrokePreview(settings.strokeWeight);
    state.isSetupRunning = false;
    state.isDrawRunning = true;
    elements.runStatus.textContent = "draw() läuft";
    highlightDrawLoop();
    updateControls();
    startDrawLoop(token);
  }

  function startSimulation() {
    if (state.isSetupRunning || state.isDrawRunning) {
      return;
    }

    const settings = readSettings(true);
    state.runToken += 1;
    const token = state.runToken;

    clearSetupTimeouts();
    stopDrawLoop();

    state.isSetupRunning = true;
    state.drawCount = 0;
    state.mouseInside = false;
    state.mousePressed = false;
    state.mousePosition = null;

    updateDrawCounter();
    updateMouseDisplay();
    updateControls();
    setCanvasSize(1, 1);
    setCanvasBackground(NEUTRAL_RGB);
    updateStrokePreview(settings.strokeWeight);
    highlightLine(elements.lineSetup);
    elements.runStatus.textContent = "setup()";

    SETUP_STEPS.forEach((step) => {
      scheduleSetupStep(token, step.delay, () => {
        if (step.action === "highlightSize") {
          setCanvasSize(settings.width, settings.height);
          setCanvasBackground(NEUTRAL_RGB);
          highlightLine(elements.lineSize);
          elements.runStatus.textContent = "size()";
        }

        if (step.action === "applySizeAndHighlightBackground") {
          setCanvasBackground(settings.backgroundRgb);
          highlightLine(elements.lineBackground);
          elements.runStatus.textContent = "background()";
        }

        if (step.action === "applyBackgroundAndHighlightStroke") {
          state.strokeWeight = settings.strokeWeight;
          updateStrokePreview(settings.strokeWeight);
          highlightLine(elements.lineStroke);
          elements.runStatus.textContent = "strokeWeight()";
        }

        if (step.action === "finishSetup") {
          completeSetup(token, settings);
        }
      });
    });
  }

  function getCanvasPoint(event) {
    const rect = elements.canvasStack.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * (elements.drawingCanvas.width / rect.width));
    const y = Math.floor((event.clientY - rect.top) * (elements.drawingCanvas.height / rect.height));

    if (x < 0 || y < 0 || x >= elements.drawingCanvas.width || y >= elements.drawingCanvas.height) {
      return null;
    }

    return { x, y };
  }

  function updatePointerPosition(event) {
    const point = getCanvasPoint(event);

    state.mouseInside = point !== null;
    state.mousePosition = point;
    updateMouseDisplay();

    return point;
  }

  function handleMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const point = updatePointerPosition(event);

    if (point === null) {
      return;
    }

    state.mousePressed = true;
    updateMouseDisplay();

    if (state.isDrawRunning) {
      drawPoint(point.x, point.y);
    }
  }

  function handleMouseMove(event) {
    const point = updatePointerPosition(event);

    if (state.mousePressed && (event.buttons & 1) !== 1) {
      state.mousePressed = false;
      updateMouseDisplay();
      return;
    }

    if (state.isDrawRunning && state.mousePressed && point !== null) {
      drawPoint(point.x, point.y);
    }
  }

  function handleMouseUp(event) {
    if (event.button !== 0) {
      return;
    }

    state.mousePressed = false;
    updateMouseDisplay();
  }

  function handleMouseLeave() {
    state.mouseInside = false;
    state.mousePressed = false;
    state.mousePosition = null;
    updateMouseDisplay();
  }

  function handleInputChange(event) {
    normalizeInput(event.currentTarget, false);
    updateStrokePreview(readInputNumber(elements.strokeWeight));

    if (state.isSetupRunning || state.isDrawRunning) {
      stopSimulationForCodeChange();
    }

    prepareNeutralCanvas();
  }

  function handleInputCommit(event) {
    normalizeInput(event.currentTarget, true);
    updateStrokePreview(readInputNumber(elements.strokeWeight));

    if (state.isSetupRunning || state.isDrawRunning) {
      stopSimulationForCodeChange();
    }

    prepareNeutralCanvas();
  }

  elements.startButton.addEventListener("click", startSimulation);
  elements.resetButton.addEventListener("click", resetSimulation);
  elements.canvasStack.addEventListener("mousedown", handleMouseDown);
  elements.canvasStack.addEventListener("mousemove", handleMouseMove);
  elements.canvasStack.addEventListener("mouseleave", handleMouseLeave);
  window.addEventListener("mouseup", handleMouseUp);

  elements.inputs.forEach((input) => {
    resizeCodeInput(input);
    input.addEventListener("input", handleInputChange);
    input.addEventListener("blur", handleInputCommit);
  });

  window.addEventListener("resize", updateCanvasDisplaySize);

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(updateCanvasDisplaySize);
    resizeObserver.observe(elements.canvasBoard);
  }

  resetSimulation();
})();
