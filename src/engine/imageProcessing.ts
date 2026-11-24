import type { DemoBlisterFixture, DemoPrescriptionCase } from '../data/demoCases';

/**
 * Stage 1: Sauvola Adaptive Local Thresholding in browser Canvas.
 * Preserves fine blue/black doctor pen strokes even under dim pharmacy lighting & shadows.
 */
export async function applySauvolaThreshold(imageDataUrl: string): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const maxWidth = 860;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageDataUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grayscale luminance array + integral images for O(1) local mean & variance
  const gray = new Float32Array(w * h);
  const integral = new Float64Array((w + 1) * (h + 1));
  const integralSq = new Float64Array((w + 1) * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const g = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      gray[y * w + x] = g;
      rowSum += g;
      rowSq += g * g;
      const ii = (y + 1) * (w + 1) + (x + 1);
      integral[ii] = integral[y * (w + 1) + (x + 1)] + rowSum;
      integralSq[ii] = integralSq[y * (w + 1) + (x + 1)] + rowSq;
    }
  }

  const radius = 11;
  const k = 0.24;
  const R = 128;

  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(w - 1, x + radius);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];

      const sumSq =
        integralSq[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integralSq[y1 * (w + 1) + (x2 + 1)] -
        integralSq[(y2 + 1) * (w + 1) + x1] +
        integralSq[y1 * (w + 1) + x1];

      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      const std = Math.sqrt(variance);
      const threshold = mean * (1 + k * (std / R - 1));

      const g = gray[y * w + x];
      const idx = (y * w + x) * 4;
      // Preserve crisp dark ink with subtle clinical slate tint on pure paper white
      if (g < threshold) {
        data[idx] = 15;
        data[idx + 1] = 23;
        data[idx + 2] = 42;
      } else {
        data[idx] = 250;
        data[idx + 1] = 252;
        data[idx + 2] = 254;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Stage 4: CIE-LAB Luminance CLAHE (Contrast Limited Adaptive Histogram Equalization)
 * removes specular glare on metallic aluminium blister strips to boost foil imprint legibility.
 */
export async function applyClaheFoilFilter(imageDataUrl: string): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const maxWidth = 760;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageDataUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Compute perceptual lightness L* in [0..255]
  const lum = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Approximate CIE-LAB L* luminance
    const yNorm = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const lStar = yNorm > 0.008856 ? 116 * Math.cbrt(yNorm) - 16 : 903.3 * yNorm;
    lum[i] = Math.max(0, Math.min(255, Math.round((lStar / 100) * 255)));
  }

  // Tile-based CLAHE (4x4 grid with clip limit)
  const tilesX = 4;
  const tilesY = 4;
  const tileW = Math.ceil(w / tilesX);
  const tileH = Math.ceil(h / tilesY);
  const cdfs: Uint8Array[][] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    cdfs[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const hist = new Uint32Array(256);
      const xStart = tx * tileW;
      const xEnd = Math.min(w, xStart + tileW);
      const yStart = ty * tileH;
      const yEnd = Math.min(h, yStart + tileH);
      let count = 0;

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          hist[lum[y * w + x]]++;
          count++;
        }
      }

      const clipLimit = Math.max(2, Math.floor((count / 256) * 2.4));
      let excess = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > clipLimit) {
          excess += hist[b] - clipLimit;
          hist[b] = clipLimit;
        }
      }
      const redist = Math.floor(excess / 256);
      for (let b = 0; b < 256; b++) {
        hist[b] += redist;
      }

      const cdf = new Uint8Array(256);
      let running = 0;
      const total = Math.max(1, count);
      for (let b = 0; b < 256; b++) {
        running += hist[b];
        cdf[b] = Math.min(255, Math.round((running / total) * 255));
      }
      cdfs[ty][tx] = cdf;
    }
  }

  // Apply bilinearly interpolated CLAHE luminance back onto RGB channels
  for (let y = 0; y < h; y++) {
    const tyFloat = (y + 0.5) / tileH - 0.5;
    const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(tyFloat)));
    const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
    const fy = Math.max(0, Math.min(1, tyFloat - ty0));

    for (let x = 0; x < w; x++) {
      const txFloat = (x + 0.5) / tileW - 0.5;
      const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(txFloat)));
      const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
      const fx = Math.max(0, Math.min(1, txFloat - tx0));

      const oldL = lum[y * w + x];
      const top = cdfs[ty0][tx0][oldL] * (1 - fx) + cdfs[ty0][tx1][oldL] * fx;
      const bot = cdfs[ty1][tx0][oldL] * (1 - fx) + cdfs[ty1][tx1][oldL] * fx;
      const newL = top * (1 - fy) + bot * fy;

      const idx = (y * w + x) * 4;
      const ratio = oldL > 4 ? newL / oldL : 1;
      // Slight contrast stretch around mid-tones to sharpen printed foil text
      const boost = (val: number) => {
        const scaled = val * ratio;
        return Math.max(0, Math.min(255, Math.round((scaled - 128) * 1.18 + 128)));
      };

      data[idx] = boost(data[idx]);
      data[idx + 1] = boost(data[idx + 1]);
      data[idx + 2] = boost(data[idx + 2]);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Isolates and crops the exact handwritten ink region [yMin, xMin, yMax, xMax] (0..1000 normalized)
 * from a prescription photo for Stage 3 Human-in-the-Loop Ambiguity Verification.
 */
export async function cropRegionDataUrl(
  imageDataUrl: string,
  bbox: [number, number, number, number],
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const [yMin, xMin, yMax, xMax] = bbox;

  const sx = Math.max(0, Math.floor((xMin / 1000) * img.width));
  const sy = Math.max(0, Math.floor((yMin / 1000) * img.height));
  const sw = Math.max(24, Math.min(img.width - sx, Math.ceil(((xMax - xMin) / 1000) * img.width)));
  const sh = Math.max(24, Math.min(img.height - sy, Math.ceil(((yMax - yMin) / 1000) * img.height)));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageDataUrl;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

/**
 * Generates a realistic Bangladeshi paper outpatient prescription pad canvas image
 * with printed chamber header (Zone A), cursive-styled Rx lines (Zone B), and schedule column (Zone C)
 * plus realistic uneven smartphone lighting shadow for demoing Stage 1 Sauvola enhancement.
 */
export function renderDemoPrescriptionCanvas(demo: DemoPrescriptionCase): string {
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Paper background with realistic pharmacy counter shadow gradient
  const bg = ctx.createLinearGradient(0, 0, 760, 980);
  bg.addColorStop(0, '#f7f5ee');
  bg.addColorStop(0.65, '#f2efe6');
  bg.addColorStop(1, '#e1ddd0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 760, 980);

  // Subtle top chamber letterhead banner
  ctx.fillStyle = '#0f3d3e';
  ctx.fillRect(0, 0, 760, 118);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(demo.doctorName, 36, 50);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 15px "DM Sans", sans-serif';
  ctx.fillText(`${demo.clinicName} · Outpatient Chamber`, 36, 78);
  ctx.fillText(`Rx ID: ${demo.prescriptionId} · Date: 20 Nov 2026`, 36, 102);

  // Zone A: Patient & Clinical Diagnosis Notes box
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 134, 696, 156);

  ctx.fillStyle = '#1e293b';
  ctx.font = '600 16px "DM Sans", sans-serif';
  ctx.fillText(`Patient: ${demo.patientName}`, 48, 178);
  ctx.fillText(`Age / Sex: ${demo.age}y / ${demo.sex}`, 450, 178);

  ctx.fillStyle = '#334155';
  ctx.font = '600 13px "DM Sans", sans-serif';
  ctx.fillText('C/C & Comorbidity Notes:', 48, 206);

  // Handwritten blue pen style diagnosis notes
  ctx.fillStyle = '#1d3557';
  ctx.font = 'italic 600 18px Georgia, serif';
  demo.diagnosisNotes.forEach((note, idx) => {
    ctx.fillText(`• ${note}`, 60, 232 + idx * 23);
  });

  // Left vertical margin divider like Bangladeshi Rx pads
  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(194, 308);
  ctx.lineTo(194, 930);
  ctx.stroke();

  // Left clinical vitals margin
  ctx.fillStyle = '#475569';
  ctx.font = '600 13px "DM Sans", sans-serif';
  ctx.fillText('O/E Vitals:', 36, 336);
  ctx.fillStyle = '#1d3557';
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillText('BP: 145/90 mmHg', 36, 368);
  ctx.fillText('Pulse: 78 /min', 36, 396);
  ctx.fillText('SpO2: 98%', 36, 424);
  ctx.fillText('Temp: 99.4°F', 36, 452);

  // Rx symbol
  ctx.fillStyle = '#0f3d3e';
  ctx.font = '700 34px Georgia, serif';
  ctx.fillText('Rx', 216, 342);

  // Zone B (Rx Lines) & Zone C (Schedule & Duration Column) cleanly aligned
  demo.rawLines.forEach((line, idx) => {
    const y = 416 + idx * 96;

    // Zone B: Medicine line
    ctx.save();
    ctx.translate(216, y);
    ctx.rotate(idx % 2 === 0 ? -0.01 : 0.008);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic 600 22px Georgia, serif';
    ctx.fillText(`${idx + 1}. ${line.ocrRaw}`, 0, 0);

    ctx.strokeStyle = 'rgba(30, 58, 138, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(240, 6);
    ctx.stroke();
    ctx.restore();

    // Zone C: Schedule & duration column on the right
    ctx.save();
    ctx.translate(502, y);
    ctx.rotate(idx % 2 === 0 ? 0.006 : -0.008);
    ctx.fillStyle = '#1e40af';
    ctx.font = 'italic 600 17px Georgia, serif';
    const [dosePart, durPart] = line.scheduleShorthand.split(/\s+for\s+/i);
    ctx.fillText(dosePart || line.scheduleShorthand, 0, -2);
    if (durPart) {
      ctx.font = 'italic 500 15px Georgia, serif';
      ctx.fillText(`× ${durPart}`, 8, 20);
    }
    ctx.restore();
  });

  // Doctor signature scribble bottom right
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(520, 910);
  ctx.bezierCurveTo(550, 880, 585, 935, 620, 895);
  ctx.bezierCurveTo(640, 875, 665, 915, 700, 902);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = '500 13px "DM Sans", sans-serif';
  ctx.fillText('Physician Signature', 548, 938);

  // Add subtle corner dim lighting shadow so Sauvola enhancement makes a visible difference
  const shadow = ctx.createRadialGradient(140, 220, 60, 420, 540, 740);
  shadow.addColorStop(0, 'rgba(255,255,255,0)');
  shadow.addColorStop(1, 'rgba(15,23,42,0.16)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, 760, 980);

  return canvas.toDataURL('image/png');
}

/**
 * Generates a realistic metallic aluminium blister-strip foil photo with diagonal
 * repeated pharma typography and specular glare highlight (ideal for Stage 4 CLAHE demo).
 */
export function renderDemoBlisterCanvas(fixture: DemoBlisterFixture): string {
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 380;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Dark pharmacy counter backdrop
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 680, 380);

  const isDamaged = fixture.damagedMode === 'scissor_cut_glare';

  // Metallic aluminium blister strip body (cut loose strip — or heavily scissor-cropped fragment)
  ctx.save();
  ctx.beginPath();
  if (isDamaged) {
    // Jagged scissor-cut small piece of foil
    ctx.moveTo(96, 66);
    ctx.lineTo(428, 52);
    ctx.lineTo(445, 92);
    ctx.lineTo(408, 146);
    ctx.lineTo(458, 212);
    ctx.lineTo(395, 298);
    ctx.lineTo(106, 314);
    ctx.lineTo(84, 236);
    ctx.lineTo(118, 162);
    ctx.closePath();
  } else {
    ctx.roundRect(42, 42, 596, 296, 14);
  }
  ctx.clip();

  const foilGrad = ctx.createLinearGradient(42, 42, 638, 338);
  foilGrad.addColorStop(0, '#cbd5e1');
  foilGrad.addColorStop(0.28, '#f8fafc');
  foilGrad.addColorStop(0.52, '#94a3b8');
  foilGrad.addColorStop(0.75, '#f1f5f9');
  foilGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = foilGrad;
  ctx.fillRect(42, 42, 596, 296);

  // Embossed blister pocket grid marks
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.25)';
  ctx.lineWidth = 2;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 2; row++) {
      ctx.beginPath();
      ctx.roundRect(72 + col * 110, 74 + row * 124, 88, 104, 18);
      ctx.stroke();
    }
  }

  // Repeated diagonal pharma foil typography (authentic Bangladeshi strip print)
  ctx.translate(340, 190);
  ctx.rotate(-0.34);

  if (isDamaged) {
    ctx.globalAlpha = 0.32;
  }

  for (let row = -3; row <= 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = col * 235 + (row % 2) * 85;
      const y = row * 74;

      ctx.fillStyle = fixture.foilColorHex;
      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(fixture.foilBrandPrint, x, y);

      ctx.fillStyle = '#1e293b';
      ctx.font = '600 12px "DM Sans", sans-serif';
      ctx.fillText(fixture.foilGenericPrint, x, y + 17);

      ctx.fillStyle = '#475569';
      ctx.font = '500 10px "DM Sans", sans-serif';
      ctx.fillText(fixture.foilManufacturer, x, y + 31);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Harsh specular aluminium glare streak across foil (heavier washout on damaged strip)
  const glare = ctx.createLinearGradient(120, 30, 480, 350);
  glare.addColorStop(0, 'rgba(255,255,255,0)');
  glare.addColorStop(0.4, isDamaged ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.62)');
  glare.addColorStop(0.55, isDamaged ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(42, 42, 596, 296);

  if (isDamaged) {
    // Crumple crease lines across foil
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, 90);
    ctx.lineTo(410, 265);
    ctx.moveTo(150, 280);
    ctx.lineTo(420, 110);
    ctx.stroke();
  }

  // Footer caption
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(
    isDamaged
      ? 'DAMAGED / SCISSOR-CUT FOIL · GLARE WASHOUT · IMPRINT ILLEGIBLE'
      : 'CUT LOOSE FOIL STRIP · BATCH #BD-2604 · EXP 11/28',
    46,
    362,
  );

  return canvas.toDataURL('image/png');
}
