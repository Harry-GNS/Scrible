const WORDS = [
  "Raices", "Viento", "Reflejo", "Musgo", "Bruma", "Semilla", "Luz",
  "Ritmo", "Horizonte", "Piedra", "Nube", "Marea", "Corteza", "Eco",
  "Lluvia", "Nectar", "Silencio", "Orbita", "Rastro", "Templo",
  "Oleaje", "Calma", "Hoguera", "Polen", "Relieve", "Pulso", "Fogata",
  "Huella", "Sombra", "Aurora"
];

const PALETTE = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ff6600", "#ff3333",
  "#33ff33", "#3366ff", "#ffcc00", "#ff0099", "#00ff99",
  "#666666", "#cccccc", "#ff9999", "#99ff99", "#9999ff"
];

const STORAGE_KEY = "daily-scribble-state";
const DURATIONS = [1, 5, 10, 15];
const API_BASE_URL = localStorage.getItem("scribble-api-base-url") || "http://localhost:3000";
let googleClientId = "";
const AUTH_STORAGE_KEY = "scribble-auth-user";

// Elements
const views = {
  landing: document.getElementById("landingView"),
  gallery: document.getElementById("galleryView"),
  prepCanvas: document.getElementById("prepCanvasView"),
  canvas: document.getElementById("canvasView")
};

const elements = {
  dailyWordCanvas: document.getElementById("dailyWordCanvas"),
  clock: document.getElementById("clock"),
  canvas: document.getElementById("drawCanvas"),
  paletteCanvas: document.getElementById("paletteCanvas"),
  brushSizeCanvas: document.getElementById("brushSizeCanvas"),
  sizeDisplay: document.getElementById("sizeDisplay"),
  clearBtnCanvas: document.getElementById("clearBtnCanvas"),
  undoBtnCanvas: document.getElementById("undoBtnCanvas"),
  finishBtnCanvas: document.getElementById("finishBtnCanvas"),
  downloadBtnCanvas: document.getElementById("downloadBtnCanvas"),
  viewGalleryBtn: document.getElementById("viewGalleryBtn"),
  startDrawingBtn: document.getElementById("startDrawingBtn"),
  backFromGalleryBtn: document.getElementById("backFromGalleryBtn"),
  backFromCanvasBtn: document.getElementById("backFromCanvasBtn"),
  galleryContent: document.getElementById("galleryContent"),
  durationBtns: Array.from(document.querySelectorAll(".duration-btn")),
  toolBtns: Array.from(document.querySelectorAll(".tool-btn")),
  customColorPicker: document.getElementById("customColorPicker"),
  eyedropperBtn: document.getElementById("eyedropperBtn"),
  signatureModal: document.getElementById("signatureModal"),
  confirmSignatureBtn: document.getElementById("confirmSignatureBtn"),
  cancelSignatureBtn: document.getElementById("cancelSignatureBtn"),
  signatureInput: document.getElementById("signatureInput"),
  redoBtnCanvas: document.getElementById("redoBtnCanvas"),
  addColorBtn: document.getElementById("addColorBtn"),
  backFromPrepBtn: document.getElementById("backFromPrepBtn"),
  wordDisplay: document.getElementById("wordDisplay"),
  durationPrepBtns: Array.from(document.querySelectorAll(".duration-prep-btn")),
  timeEndModal: document.getElementById("timeEndModal"),
  closeTimeEndBtn: document.getElementById("closeTimeEndBtn"),
  backendStatus: document.getElementById("backendStatus"),
  authStatus: document.getElementById("authStatus"),
  googleSignInContainer: document.getElementById("googleSignInContainer"),
  logoutBtn: document.getElementById("logoutBtn")
};

// State
const state = {
  currentView: "landing",
  selectedDuration: 1,
  selectedMinutes: 0,
  remainingSeconds: 0,
  timerId: null,
  color: PALETTE[0],
  tool: "brush", // brush, eraser, line, rect, circle, bucket
  drawing: false,
  sessionActive: false,
  lastPoint: null,
  isDrawingShape: false,
  shapeStart: null,
  history: [],
  historyIndex: -1,
  maxHistory: 20,
  galleries: {
    1: [],
    5: [],
    10: [],
    15: []
  },
  eyedropperActive: false,
  pendingFinish: false,
  currentUser: null
};

const today = getTodayKey();
const dailyWord = pickWordForToday(today);

// Initialize
elements.dailyWordCanvas.textContent = dailyWord;
initPalette();
initCanvas();
setupEvents();
hydrateDailyState();
updateClock(0);
checkBackendConnection();
hydrateAuthState();
initGoogleAuth();

async function checkBackendConnection() {
  if (!elements.backendStatus) {
    return;
  }

  const statusElement = elements.backendStatus;
  statusElement.className = "backend-status checking";
  statusElement.textContent = "Verificando backend...";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    statusElement.className = "backend-status ok";
    statusElement.textContent = "Backend conectado";
  } catch (error) {
    statusElement.className = "backend-status error";
    statusElement.textContent = "Backend no disponible";
  } finally {
    clearTimeout(timeout);
  }
}

function hydrateAuthState() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    renderAuthState();
    return;
  }

  try {
    state.currentUser = JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    state.currentUser = null;
  }

  renderAuthState();
}

function renderAuthState() {
  if (!elements.authStatus || !elements.logoutBtn) {
    return;
  }

  if (!state.currentUser) {
    elements.authStatus.textContent = "No has iniciado sesion";
    elements.logoutBtn.hidden = true;
    return;
  }

  elements.authStatus.textContent = `Sesion: ${state.currentUser.name}`;
  elements.logoutBtn.hidden = false;
}

async function initGoogleAuth() {
  if (!elements.googleSignInContainer || !elements.authStatus || !elements.logoutBtn) {
    return;
  }

  elements.logoutBtn.addEventListener("click", () => {
    state.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    renderAuthState();
  });

  try {
    const configResponse = await fetch(`${API_BASE_URL}/auth/config`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      googleClientId = String(config.googleClientId ?? "").trim();
    }
  } catch (error) {
    elements.authStatus.textContent = "No se pudo leer configuracion de Google";
    return;
  }

  if (!googleClientId) {
    elements.authStatus.textContent = "Google login no configurado en backend (.env)";
    return;
  }

  const maxAttempts = 20;
  let attempts = 0;
  const poll = setInterval(() => {
    attempts += 1;

    if (window.google?.accounts?.id) {
      clearInterval(poll);
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential
      });

      window.google.accounts.id.renderButton(elements.googleSignInContainer, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signup_with"
      });
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(poll);
      elements.authStatus.textContent = "No se pudo cargar Google Sign-In";
    }
  }, 250);
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    return;
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        credential: response.credential
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    state.currentUser = data.user;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
    renderAuthState();
  } catch (error) {
    elements.authStatus.textContent = "Error autenticando con Google";
  }
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickWordForToday(dayKey) {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return WORDS[hash % WORDS.length];
}

function initPalette() {
  PALETTE.forEach((hex, index) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.type = "button";
    button.style.background = hex;
    button.title = hex;
    if (index === 0) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      state.color = hex;
      document.querySelectorAll(".palette-grid .swatch").forEach((swatch) => swatch.classList.remove("active"));
      button.classList.add("active");
    });
    elements.paletteCanvas.appendChild(button);
  });
}

function initCanvas() {
  const ctx = elements.canvas.getContext("2d", { willReadFrequently: true });
  elements.canvas.ctx = ctx;
  clearCanvas(true);
  saveHistory();
}

function setupEvents() {
  // Navigation
  elements.viewGalleryBtn.addEventListener("click", () => goToGallery());
  elements.startDrawingBtn.addEventListener("click", () => goToPrepCanvas());
  elements.backFromGalleryBtn.addEventListener("click", () => goToLanding());
  elements.backFromCanvasBtn.addEventListener("click", () => goToLanding());
  elements.backFromPrepBtn.addEventListener("click", () => goToLanding());

  // Gallery duration filter
  elements.durationBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.durationBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedDuration = Number(btn.dataset.duration);
      updateGalleryView();
    });
  });

  // Prep canvas duration buttons
  elements.durationPrepBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectTimer(Number(btn.dataset.minutes));
      goToCanvas();
    });
  });

  // Time end modal
  elements.closeTimeEndBtn.addEventListener("click", closeTimeEndModal);

  // Tools
  elements.toolBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.toolBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tool = btn.dataset.tool;
      if (tool === "eyedropper") {
        state.eyedropperActive = true;
        state.tool = "brush"; // Keep brush as default tool
      } else {
        state.eyedropperActive = false;
        state.tool = tool;
      }
    });
  });

  // Canvas controls
  elements.brushSizeCanvas.addEventListener("input", () => {
    elements.sizeDisplay.textContent = elements.brushSizeCanvas.value;
  });

  elements.clearBtnCanvas.addEventListener("click", () => {
    clearCanvas(false);
    saveHistory();
  });

  elements.undoBtnCanvas.addEventListener("click", () => {
    undo();
  });

  elements.redoBtnCanvas.addEventListener("click", () => {
    redo();
  });

  elements.finishBtnCanvas.addEventListener("click", openSignatureModal);
  elements.downloadBtnCanvas.addEventListener("click", downloadCurrentCanvas);

  // Color picker
  elements.customColorPicker.addEventListener("input", (e) => {
    state.color = e.target.value;
    document.querySelectorAll(".palette-grid .swatch").forEach((swatch) => swatch.classList.remove("active"));
  });

  // Add color to palette
  elements.addColorBtn.addEventListener("click", () => {
    const color = elements.customColorPicker.value;
    const button = document.createElement("button");
    button.className = "swatch";
    button.type = "button";
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => {
      state.color = color;
      document.querySelectorAll(".palette-grid .swatch").forEach((swatch) => swatch.classList.remove("active"));
      button.classList.add("active");
    });
    elements.paletteCanvas.appendChild(button);
  });

  // Modal buttons
  elements.cancelSignatureBtn.addEventListener("click", closeSignatureModal);
  elements.confirmSignatureBtn.addEventListener("click", confirmSignature);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
  });

  bindCanvasEvents();
}

function toggleEyedropper() {
  state.eyedropperActive = !state.eyedropperActive;
  elements.eyedropperBtn.classList.toggle("active", state.eyedropperActive);
  elements.canvas.style.cursor = state.eyedropperActive ? "crosshair" : "default";
}

function openSignatureModal() {
  if (!state.sessionActive && !state.pendingFinish) {
    return;
  }
  state.pendingFinish = true;
  elements.signatureModal.classList.add("active");
}

function closeSignatureModal() {
  state.pendingFinish = false;
  elements.signatureModal.classList.remove("active");
  elements.signatureInput.value = "";
}

async function confirmSignature() {
  const isNamed = document.querySelector('input[name="signature"]:checked').value === "named";
  const signature = isNamed ? elements.signatureInput.value.trim() : "";

  elements.confirmSignatureBtn.disabled = true;
  elements.confirmSignatureBtn.textContent = "Subiendo...";

  try {
    await finishSession(signature);
    closeSignatureModal();
  } finally {
    elements.confirmSignatureBtn.disabled = false;
    elements.confirmSignatureBtn.textContent = "Compartir";
  }
}

function openTimeEndModal() {
  elements.timeEndModal.classList.add("active");
}

function closeTimeEndModal() {
  elements.timeEndModal.classList.remove("active");
}

function bindCanvasEvents() {
  const canvas = elements.canvas;

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.sessionActive && !state.eyedropperActive) {
      return;
    }

    const point = getCanvasPoint(event);

    // Eyedropper mode
    if (state.eyedropperActive) {
      const imageData = elements.canvas.ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
      const data = imageData.data;
      const hex = rgbToHex(data[0], data[1], data[2]);
      state.color = hex;
      elements.customColorPicker.value = hex;
      state.eyedropperActive = false;
      elements.eyedropperBtn.classList.remove("active");
      elements.canvas.style.cursor = "crosshair";
      return;
    }

    if (state.tool === "bucket") {
      floodFill(point.x, point.y);
      saveHistory();
      return;
    }

    state.drawing = true;
    state.lastPoint = point;

    if (["line", "rect", "circle"].includes(state.tool)) {
      state.isDrawingShape = true;
      state.shapeStart = point;
      // Save state before drawing shape for preview
      saveCanvasToHistory();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing) return;

    const point = getCanvasPoint(event);

    if (state.isDrawingShape) {
      // Preview shape by restoring and redrawing
      restoreFromHistory(state.history.length - 1);
      drawShape(state.shapeStart, point);
    } else {
      drawLine(state.lastPoint, point);
      state.lastPoint = point;
    }
  });

  const stop = () => {
    if (!state.drawing) return;
    state.drawing = false;

    if (state.isDrawingShape) {
      state.isDrawingShape = false;
      saveHistory();
    }
  };

  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  canvas.addEventListener("pointercancel", stop);
}

function drawLine(from, to) {
  const ctx = elements.canvas.ctx;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Number(elements.brushSizeCanvas.value);

  if (state.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.strokeStyle = state.color;
  }

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawShape(start, end) {
  const ctx = elements.canvas.ctx;
  const width = end.x - start.x;
  const height = end.y - start.y;

  ctx.save();
  ctx.strokeStyle = state.color;
  ctx.lineWidth = Number(elements.brushSizeCanvas.value);
  ctx.fillStyle = "transparent";

  if (state.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (state.tool === "rect") {
    ctx.strokeRect(start.x, start.y, width, height);
  } else if (state.tool === "circle") {
    const radius = Math.sqrt(width * width + height * height) / 2;
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function floodFill(x, y) {
  const ctx = elements.canvas.ctx;
  const imageData = ctx.getImageData(0, 0, elements.canvas.width, elements.canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Get target color at click point
  const pixelIndex = (Math.floor(y) * width + Math.floor(x)) * 4;
  const targetColor = [data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2], data[pixelIndex + 3]];

  // Parse fill color
  const fillColor = hexToRgb(state.color);

  // Check if target and fill colors are the same
  if (colorsEqual(targetColor, fillColor)) return;

  // Flood fill using BFS
  const queue = [[Math.floor(x), Math.floor(y)]];
  const visited = new Set();

  while (queue.length > 0) {
    const [px, py] = queue.shift();

    if (px < 0 || px >= width || py < 0 || py >= height) continue;

    const key = `${px},${py}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const idx = (py * width + px) * 4;
    if (!colorsEqual([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]], targetColor)) {
      continue;
    }

    // Paint pixel
    data[idx] = fillColor[0];
    data[idx + 1] = fillColor[1];
    data[idx + 2] = fillColor[2];
    data[idx + 3] = 255;

    // Add neighbors
    queue.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

function colorsEqual(color1, color2) {
  const tolerance = 10;
  return (
    Math.abs(color1[0] - color2[0]) < tolerance &&
    Math.abs(color1[1] - color2[1]) < tolerance &&
    Math.abs(color1[2] - color2[2]) < tolerance
  );
}

function getCanvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
  return { x, y };
}

function saveCanvasToHistory() {
  const imageData = elements.canvas.ctx.getImageData(
    0, 0, elements.canvas.width, elements.canvas.height
  );
  // Remove any redo history if we're saving something new
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(imageData);
  state.historyIndex = state.history.length - 1;
  if (state.history.length > state.maxHistory) {
    state.history.shift();
    state.historyIndex--;
  }
}

function saveHistory() {
  saveCanvasToHistory();
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  restoreFromHistory(state.historyIndex);
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  restoreFromHistory(state.historyIndex);
}

function restoreFromHistory(index) {
  if (index < 0 || index >= state.history.length) return;
  const imageData = state.history[index];
  elements.canvas.ctx.putImageData(imageData, 0, 0);
}

function selectTimer(minutes) {
  state.selectedMinutes = minutes;
  state.remainingSeconds = minutes * 60;
  startSession();
}

function startSession() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  state.sessionActive = true;
  updateClock(state.remainingSeconds);

  state.timerId = window.setInterval(() => {
    state.remainingSeconds -= 1;
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      updateClock(state.remainingSeconds);
      state.sessionActive = false;
      openTimeEndModal();
      clearInterval(state.timerId);
      state.timerId = null;
      return;
    }
    updateClock(state.remainingSeconds);
  }, 1000);
}

async function finishSession(signature = "") {
  if (!state.selectedMinutes) {
    return;
  }

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  state.sessionActive = false;
  state.drawing = false;
  state.pendingFinish = false;

  const blob = await exportCanvasBlobWithSignature(signature);
  const uploadedUrl = await uploadArtworkToCloud(blob);
  const dataUrl = exportCanvasWithSignature(signature);
  const item = {
    id: crypto.randomUUID(),
    word: dailyWord,
    minutes: state.selectedMinutes,
    createdAt: Date.now(),
    image: uploadedUrl || dataUrl,
    storage: uploadedUrl ? "cloud" : "local"
  };

  state.galleries[state.selectedMinutes].push(item);
  persistDailyState();

  // Reset canvas and history
  state.history = [];
  state.historyIndex = -1;
  clearCanvas(true);
  saveHistory();

  // Redirect to gallery
  goToGallery();
}

async function uploadArtworkToCloud(blob) {
  if (!(blob instanceof Blob)) {
    return null;
  }

  const userId = state.currentUser?.userId || `anon-${crypto.randomUUID()}`;

  try {
    const signResponse = await fetch(`${API_BASE_URL}/storage/presign-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        duration: state.selectedMinutes,
        contentType: blob.type,
        fileSizeBytes: blob.size
      })
    });

    if (!signResponse.ok) {
      throw new Error(`sign failed: HTTP ${signResponse.status}`);
    }

    const signData = await signResponse.json();
    const uploadResponse = await fetch(signData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": blob.type
      },
      body: blob
    });

    if (!uploadResponse.ok) {
      throw new Error(`upload failed: HTTP ${uploadResponse.status}`);
    }

    return signData.publicUrl;
  } catch (_error) {
    return null;
  }
}

function updateClock(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  elements.clock.textContent = `${mm}:${ss}`;
}

function clearCanvas(initial) {
  const ctx = elements.canvas.ctx;
  ctx.fillStyle = initial ? "#fff" : "#fffdf9";
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

  if (!initial) {
    ctx.save();
    ctx.strokeStyle = "rgba(32, 59, 45, 0.1)";
    ctx.setLineDash([8, 9]);
    ctx.strokeRect(10, 10, elements.canvas.width - 20, elements.canvas.height - 20);
    ctx.restore();
  }
}

function drawSignature(ctx, width, height, signature) {
  if (!signature) return;

  ctx.save();
  ctx.fillStyle = "rgba(32, 59, 45, 0.75)";
  ctx.font = '22px "Patrick Hand", cursive';
  ctx.textAlign = "right";
  ctx.fillText(`~ ${signature}`, width - 18, height - 18);
  ctx.restore();
}

function downloadCurrentCanvas() {
  const link = document.createElement("a");
  link.href = exportCanvasWithSignature("");
  link.download = `scribble-${today}.png`;
  link.click();
}

function exportCanvasWithSignature(signature = "") {
  const off = document.createElement("canvas");
  off.width = elements.canvas.width;
  off.height = elements.canvas.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(elements.canvas, 0, 0);
  drawSignature(offCtx, off.width, off.height, signature);
  return off.toDataURL("image/png");
}

function exportCanvasBlobWithSignature(signature = "") {
  const off = document.createElement("canvas");
  off.width = elements.canvas.width;
  off.height = elements.canvas.height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(elements.canvas, 0, 0);
  drawSignature(offCtx, off.width, off.height, signature);

  return new Promise((resolve) => {
    off.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/webp",
      0.9
    );
  });
}

function persistDailyState() {
  const payload = {
    day: today,
    word: dailyWord,
    galleries: state.galleries
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateDailyState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.day !== today) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    DURATIONS.forEach((duration) => {
      state.galleries[duration] = Array.isArray(parsed.galleries?.[duration])
        ? parsed.galleries[duration]
        : [];
    });
  } catch (_err) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// VIEW NAVIGATION
function showView(viewName) {
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[viewName].classList.add("active");
  state.currentView = viewName;

  if (viewName === "gallery") {
    updateGalleryView();
  }
}

function goToLanding() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  state.sessionActive = false;
  state.pendingFinish = false;

  // Reset canvas
  state.history = [];
  state.historyIndex = -1;
  clearCanvas(true);
  saveHistory();

  showView("landing");
}

function goToGallery() {
  showView("gallery");
}

function goToPrepCanvas() {
  // Reset canvas before going to prep
  state.history = [];
  state.historyIndex = -1;
  clearCanvas(true);
  saveHistory();

  elements.wordDisplay.textContent = dailyWord;
  showView("prepCanvas");
}

function goToCanvas() {
  showView("canvas");
}

function updateGalleryView() {
  elements.galleryContent.innerHTML = "";
  const duration = state.selectedDuration;
  const host = document.createElement("div");
  host.className = "physics-host";
  host.id = `gallery-${duration}`;
  elements.galleryContent.appendChild(host);

  // Initialize physics for this gallery
  const width = host.clientWidth;
  const height = host.clientHeight;

  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0.52 }
  });

  const render = Matter.Render.create({
    element: host,
    engine,
    options: {
      width,
      height,
      wireframes: false,
      background: "transparent",
      pixelRatio: window.devicePixelRatio || 1
    }
  });

  const floor = Matter.Bodies.rectangle(width / 2, height + 18, width, 36, {
    isStatic: true,
    render: { fillStyle: "#d3c6a1" }
  });

  const leftWall = Matter.Bodies.rectangle(-18, height / 2, 36, height, {
    isStatic: true,
    render: { visible: false }
  });

  const rightWall = Matter.Bodies.rectangle(width + 18, height / 2, 36, height, {
    isStatic: true,
    render: { visible: false }
  });

  Matter.World.add(engine.world, [floor, leftWall, rightWall]);
  Matter.Runner.run(Matter.Runner.create(), engine);
  Matter.Render.run(render);

  // Add existing drawings
  const items = state.galleries[duration] || [];
  items.forEach((item, idx) => {
    window.setTimeout(() => {
      const w = 120;
      const h = 80;

      const body = Matter.Bodies.rectangle(
        randomRange(50, width - 50),
        -30,
        w,
        h,
        {
          chamfer: { radius: 8 },
          restitution: 0.25,
          friction: 0.5,
          frictionAir: 0.028,
          render: {
            sprite: {
              texture: item.image,
              xScale: w / elements.canvas.width,
              yScale: h / elements.canvas.height
            }
          }
        }
      );

      Matter.Body.setAngle(body, randomRange(-0.18, 0.18));
      Matter.World.add(engine.world, body);
    }, idx * 80);
  });
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

