const CM_PER_IN = 2.54;
const DPI = 300;

const PHOTO_CM = { w: 3, h: 4 };
const PHOTO_PX = {
  w: Math.round((PHOTO_CM.w / CM_PER_IN) * DPI),
  h: Math.round((PHOTO_CM.h / CM_PER_IN) * DPI),
};

const PRINT_IN = { w: 6, h: 4 }; // horizontal 4x6
const SHEET_PX = {
  w: Math.round(PRINT_IN.w * DPI),
  h: Math.round(PRINT_IN.h * DPI),
};

const GRID = { cols: 4, rows: 2, count: 8 };
const GAP_PX = Math.round(0.12 * DPI);
const MIN_CROP = 40;

const imageInput = document.getElementById('imageInput');
const editorCanvas = document.getElementById('editorCanvas');
const sheetCanvas = document.getElementById('sheetCanvas');
const convertBtn = document.getElementById('convertBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadJpegBtn = document.getElementById('downloadJpegBtn');
const resetBtn = document.getElementById('resetBtn');

const brightnessSlider = document.getElementById('brightness');
const contrastSlider = document.getElementById('contrast');
const saturationSlider = document.getElementById('saturation');
const redSlider = document.getElementById('red');
const greenSlider = document.getElementById('green');
const blueSlider = document.getElementById('blue');

const brightnessValue = document.getElementById('brightnessValue');
const contrastValue = document.getElementById('contrastValue');
const saturationValue = document.getElementById('saturationValue');
const redValue = document.getElementById('redValue');
const greenValue = document.getElementById('greenValue');
const blueValue = document.getElementById('blueValue');

const ectx = editorCanvas.getContext('2d');
const sctx = sheetCanvas.getContext('2d');

sheetCanvas.width = SHEET_PX.w;
sheetCanvas.height = SHEET_PX.h;

const state = {
  img: null,
  imageBox: null,
  crop: null,
  dragMode: null,
  dragHandle: null,
  dragStart: null,
  beforeDragCrop: null,
};

function adjustmentValues() {
  return {
    brightness: Number(brightnessSlider.value),
    contrast: Number(contrastSlider.value),
    saturation: Number(saturationSlider.value),
    red: Number(redSlider.value),
    green: Number(greenSlider.value),
    blue: Number(blueSlider.value),
  };
}

function updateLabels() {
  const v = adjustmentValues();
  brightnessValue.textContent = v.brightness.toFixed(2);
  contrastValue.textContent = v.contrast.toFixed(2);
  saturationValue.textContent = v.saturation.toFixed(2);
  redValue.textContent = v.red.toFixed(2);
  greenValue.textContent = v.green.toFixed(2);
  blueValue.textContent = v.blue.toFixed(2);
}

function drawPlaceholder(textTop, textBottom) {
  sctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  sctx.textAlign = 'center';
  sctx.fillStyle = '#4b5563';
  sctx.font = '44px sans-serif';
  sctx.fillText(textTop, sheetCanvas.width / 2, 120);
  sctx.fillStyle = '#6b7280';
  sctx.font = '29px sans-serif';
  sctx.fillText(textBottom, sheetCanvas.width / 2, 176);
}

function resetState() {
  state.img = null;
  state.imageBox = null;
  state.crop = null;
  state.dragMode = null;
  state.dragHandle = null;
  drawEditor();
  drawPlaceholder('Prime Photos — 6×4 Preview', 'Upload an image to begin');
}

function applyColorBalance(ctx, width, height, red, green, blue) {
  if (Math.abs(red - 1) < 0.001 && Math.abs(green - 1) < 0.001 && Math.abs(blue - 1) < 0.001) {
    return;
  }

  const frame = ctx.getImageData(0, 0, width, height);
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * red);
    d[i + 1] = Math.min(255, d[i + 1] * green);
    d[i + 2] = Math.min(255, d[i + 2] * blue);
  }
  ctx.putImageData(frame, 0, 0);
}

function renderAdjustedSourceToCanvas({ sx, sy, sw, sh, dx, dy, dw, dh, targetCtx, targetW, targetH }) {
  if (!state.img) return;
  const v = adjustmentValues();

  targetCtx.clearRect(0, 0, targetW, targetH);
  targetCtx.filter = `brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.saturation})`;
  targetCtx.drawImage(state.img, sx, sy, sw, sh, dx, dy, dw, dh);
  targetCtx.filter = 'none';
  applyColorBalance(targetCtx, targetW, targetH, v.red, v.green, v.blue);
}

function drawEditor() {
  ectx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  ectx.fillStyle = '#10182d';
  ectx.fillRect(0, 0, editorCanvas.width, editorCanvas.height);

  if (!state.img || !state.imageBox) {
    ectx.textAlign = 'center';
    ectx.fillStyle = '#9db4de';
    ectx.font = '24px sans-serif';
    ectx.fillText('Drop or upload an image to start', editorCanvas.width / 2, editorCanvas.height / 2);
    return;
  }

  const b = state.imageBox;
  const sx = 0;
  const sy = 0;
  const sw = state.img.width;
  const sh = state.img.height;
  renderAdjustedSourceToCanvas({ sx, sy, sw, sh, dx: b.x, dy: b.y, dw: b.w, dh: b.h, targetCtx: ectx, targetW: editorCanvas.width, targetH: editorCanvas.height });

  if (state.crop) drawCropOutline();
}

function drawCropOutline() {
  const c = state.crop;
  ectx.save();
  ectx.strokeStyle = '#34d3ff';
  ectx.lineWidth = 1.5;
  ectx.strokeRect(c.x, c.y, c.w, c.h);

  const hs = 8;
  handlesFor(c).forEach((h) => {
    ectx.strokeStyle = '#8f6dff';
    ectx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
  });
  ectx.restore();
}

function handlesFor(c) {
  const x2 = c.x + c.w;
  const y2 = c.y + c.h;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return [
    { id: 'nw', x: c.x, y: c.y },
    { id: 'n', x: cx, y: c.y },
    { id: 'ne', x: x2, y: c.y },
    { id: 'e', x: x2, y: cy },
    { id: 'se', x: x2, y: y2 },
    { id: 's', x: cx, y: y2 },
    { id: 'sw', x: c.x, y: y2 },
    { id: 'w', x: c.x, y: cy },
  ];
}

function pointFromEvent(e) {
  const r = editorCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (editorCanvas.width / r.width),
    y: (e.clientY - r.top) * (editorCanvas.height / r.height),
  };
}

function isInside(p, c) {
  return p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
}

function hitHandle(p, c) {
  const radius = 12;
  for (const h of handlesFor(c)) {
    if (Math.abs(p.x - h.x) <= radius && Math.abs(p.y - h.y) <= radius) return h.id;
  }
  return null;
}

function clampCrop(c) {
  const b = state.imageBox;
  c.w = Math.max(MIN_CROP, c.w);
  c.h = Math.max(MIN_CROP, c.h);

  if (c.w > b.w) {
    c.w = b.w;
    c.x = b.x;
  }
  if (c.h > b.h) {
    c.h = b.h;
    c.y = b.y;
  }

  if (c.x < b.x) c.x = b.x;
  if (c.y < b.y) c.y = b.y;
  if (c.x + c.w > b.x + b.w) c.x = b.x + b.w - c.w;
  if (c.y + c.h > b.y + b.h) c.y = b.y + b.h - c.h;
}

function defaultCrop() {
  const b = state.imageBox;
  state.crop = {
    x: b.x + b.w * 0.2,
    y: b.y + b.h * 0.15,
    w: b.w * 0.6,
    h: b.h * 0.7,
  };
  clampCrop(state.crop);
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      const scale = Math.min(editorCanvas.width / img.width, editorCanvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      state.imageBox = {
        x: (editorCanvas.width - w) / 2,
        y: (editorCanvas.height - h) / 2,
        w,
        h,
      };
      defaultCrop();
      drawEditor();
      generateSheet();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function cropToRatioRect(sx, sy, sw, sh, targetRatio) {
  const sourceRatio = sw / sh;
  if (Math.abs(sourceRatio - targetRatio) < 0.0001) return { sx, sy, sw, sh };

  if (sourceRatio > targetRatio) {
    const newW = sh * targetRatio;
    return { sx: sx + (sw - newW) / 2, sy, sw: newW, sh };
  }

  const newH = sw / targetRatio;
  return { sx, sy: sy + (sh - newH) / 2, sw, sh: newH };
}

function makePassportTile() {
  if (!state.img || !state.crop || !state.imageBox) return null;
  const c = state.crop;
  const ib = state.imageBox;

  let sx = ((c.x - ib.x) / ib.w) * state.img.width;
  let sy = ((c.y - ib.y) / ib.h) * state.img.height;
  let sw = (c.w / ib.w) * state.img.width;
  let sh = (c.h / ib.h) * state.img.height;

  ({ sx, sy, sw, sh } = cropToRatioRect(sx, sy, sw, sh, PHOTO_CM.w / PHOTO_CM.h));

  const tile = document.createElement('canvas');
  tile.width = PHOTO_PX.w;
  tile.height = PHOTO_PX.h;
  const tctx = tile.getContext('2d');

  renderAdjustedSourceToCanvas({
    sx,
    sy,
    sw,
    sh,
    dx: 0,
    dy: 0,
    dw: PHOTO_PX.w,
    dh: PHOTO_PX.h,
    targetCtx: tctx,
    targetW: PHOTO_PX.w,
    targetH: PHOTO_PX.h,
  });

  return tile;
}

function generateSheet() {
  const tile = makePassportTile();
  if (!tile) {
    drawPlaceholder('Prime Photos — 6×4 Preview', 'Upload an image to begin');
    return;
  }

  sctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

  const totalW = GRID.cols * PHOTO_PX.w + (GRID.cols - 1) * GAP_PX;
  const totalH = GRID.rows * PHOTO_PX.h + (GRID.rows - 1) * GAP_PX;
  const startX = (sheetCanvas.width - totalW) / 2;
  const startY = (sheetCanvas.height - totalH) / 2;

  let placed = 0;
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      if (placed >= GRID.count) break;
      const x = startX + c * (PHOTO_PX.w + GAP_PX);
      const y = startY + r * (PHOTO_PX.h + GAP_PX);
      sctx.drawImage(tile, x, y, PHOTO_PX.w, PHOTO_PX.h);
      sctx.strokeStyle = '#6d7fa8';
      sctx.lineWidth = 1;
      sctx.strokeRect(x, y, PHOTO_PX.w, PHOTO_PX.h);
      placed += 1;
    }
  }
}

function download(type) {
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const anchor = document.createElement('a');
  anchor.href = sheetCanvas.toDataURL(type, 0.97);
  anchor.download = `prime-photos-passport-6x4.${ext}`;
  anchor.click();
}

function updateMove(pt) {
  const dx = pt.x - state.dragStart.x;
  const dy = pt.y - state.dragStart.y;
  const base = state.beforeDragCrop;
  const next = { ...base, x: base.x + dx, y: base.y + dy };
  clampCrop(next);
  state.crop = next;
}

function updateResize(pt) {
  const h = state.dragHandle;
  const base = state.beforeDragCrop;
  const right = base.x + base.w;
  const bottom = base.y + base.h;
  const next = { ...base };

  if (h.includes('n')) {
    next.y = Math.min(pt.y, bottom - MIN_CROP);
    next.h = bottom - next.y;
  }
  if (h.includes('s')) {
    next.h = Math.max(MIN_CROP, pt.y - base.y);
  }
  if (h.includes('w')) {
    next.x = Math.min(pt.x, right - MIN_CROP);
    next.w = right - next.x;
  }
  if (h.includes('e')) {
    next.w = Math.max(MIN_CROP, pt.x - base.x);
  }
  if (h === 'n' || h === 's') {
    next.x = base.x;
    next.w = base.w;
  }
  if (h === 'e' || h === 'w') {
    next.y = base.y;
    next.h = base.h;
  }

  clampCrop(next);
  state.crop = next;
}

editorCanvas.addEventListener('pointerdown', (e) => {
  if (!state.imageBox) return;
  editorCanvas.setPointerCapture(e.pointerId);
  const pt = pointFromEvent(e);

  if (state.crop) {
    const handle = hitHandle(pt, state.crop);
    if (handle) {
      state.dragMode = 'resize';
      state.dragHandle = handle;
      state.dragStart = pt;
      state.beforeDragCrop = { ...state.crop };
      return;
    }

    if (isInside(pt, state.crop)) {
      state.dragMode = 'move';
      state.dragHandle = null;
      state.dragStart = pt;
      state.beforeDragCrop = { ...state.crop };
      return;
    }
  }

  state.dragMode = 'draw';
  state.dragHandle = null;
  state.dragStart = pt;
  state.beforeDragCrop = null;
  state.crop = { x: pt.x, y: pt.y, w: MIN_CROP, h: MIN_CROP };
  clampCrop(state.crop);
  drawEditor();
  generateSheet();
});

editorCanvas.addEventListener('pointermove', (e) => {
  if (!state.dragMode || !state.imageBox) return;
  const pt = pointFromEvent(e);

  if (state.dragMode === 'move') {
    updateMove(pt);
  } else if (state.dragMode === 'resize') {
    updateResize(pt);
  } else if (state.dragMode === 'draw') {
    const x = Math.min(pt.x, state.dragStart.x);
    const y = Math.min(pt.y, state.dragStart.y);
    const w = Math.max(MIN_CROP, Math.abs(pt.x - state.dragStart.x));
    const h = Math.max(MIN_CROP, Math.abs(pt.y - state.dragStart.y));
    state.crop = { x, y, w, h };
    clampCrop(state.crop);
  }

  drawEditor();
  generateSheet();
});

function stopDrag(e) {
  if (editorCanvas.hasPointerCapture(e.pointerId)) {
    editorCanvas.releasePointerCapture(e.pointerId);
  }
  state.dragMode = null;
  state.dragHandle = null;
  state.dragStart = null;
  state.beforeDragCrop = null;
}

editorCanvas.addEventListener('pointerup', stopDrag);
editorCanvas.addEventListener('pointercancel', stopDrag);

function resetAllControls() {
  [brightnessSlider, contrastSlider, saturationSlider, redSlider, greenSlider, blueSlider].forEach((s) => {
    s.value = '1';
  });
  updateLabels();
}

imageInput.addEventListener('change', (e) => {
  const [file] = e.target.files;
  loadImageFile(file);
});

editorCanvas.addEventListener('dragover', (e) => {
  e.preventDefault();
});

editorCanvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const [file] = e.dataTransfer.files;
  loadImageFile(file);
});

[brightnessSlider, contrastSlider, saturationSlider, redSlider, greenSlider, blueSlider].forEach((el) => {
  el.addEventListener('input', () => {
    updateLabels();
    drawEditor();
    generateSheet();
  });
});

convertBtn.addEventListener('click', generateSheet);
downloadPngBtn.addEventListener('click', () => download('image/png'));
downloadJpegBtn.addEventListener('click', () => download('image/jpeg'));
resetBtn.addEventListener('click', () => {
  imageInput.value = '';
  resetAllControls();
  resetState();
});

resetAllControls();
resetState();
