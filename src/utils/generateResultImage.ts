import { Personality } from '../types.ts';
import { toBengaliDigits } from '../data/quizData.ts';
import { getPublicAssetUrl } from './assets.ts';

export interface RenderOptions {
  score: number;
  personality: Personality;
  playerName?: string;
  profileImageUrl?: string | null;
}

export interface GeneratedResultAssets {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

// Background template image (Image 2: Clean background template)
const getTemplateImgSrc = () => getPublicAssetUrl('assets/aistudio/1a_2ae07336.jpg');

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB client-side guard

/**
 * Validates, center-crops into a square, and downscales a user-selected image
 * completely client-side in the browser. Never uploads to any server.
 */
export async function processProfileImageFile(file: File): Promise<string> {
  if (!file) {
    throw new Error('কোনো ছবি নির্বাচন করা হয়নি।');
  }

  const fileType = (file.type || '').toLowerCase();
  const hasImageExtension = /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || '');

  if (!ALLOWED_IMAGE_TYPES.has(fileType) && !fileType.startsWith('image/') && !hasImageExtension) {
    throw new Error('দয়া করে একটি সঠিক ছবি (JPG, PNG বা WebP) নির্বাচন করুন।');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('ছবির সাইজ ২০ মেগাবাইটের বেশি হতে পারবে না। দয়া করে ছোট ছবি নির্বাচন করুন।');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) {
      throw new Error('ছবিটি পড়া সম্ভব হয়নি। অন্য একটি ছবি চেষ্টা করুন।');
    }

    // Center square crop and downscale to 300x300 for sharp circular rendering and low memory usage
    const targetSize = 300;
    const cropSize = Math.min(naturalW, naturalH);
    const sx = (naturalW - cropSize) / 2;
    const sy = (naturalH - cropSize) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ব্রাউজারে ছবি প্রসেস করা সম্ভব হয়নি।');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Helper to draw rounded rectangle
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// Helper to wrap text cleanly
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// Truncate single-line text gracefully with ellipsis if it exceeds maxWidth
function fitSingleLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialFontSize: number,
  minFontSize: number,
  fontWeight = 'bold'
): { text: string; fontSize: number } {
  let fontSize = initialFontSize;
  ctx.font = `${fontWeight} ${fontSize}px "Hind Siliguri", sans-serif`;

  while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
    fontSize -= 1;
    ctx.font = `${fontWeight} ${fontSize}px "Hind Siliguri", sans-serif`;
  }

  if (ctx.measureText(text).width <= maxWidth) {
    return { text, fontSize };
  }

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1).trimEnd();
  }
  return { text: `${truncated}…`, fontSize };
}

// Ensure web fonts are completely loaded before measuring or rendering
async function ensureFontsLoaded(): Promise<void> {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('bold 64px "Hind Siliguri"'),
        document.fonts.load('bold 52px "Hind Siliguri"'),
        document.fonts.load('bold 44px "Hind Siliguri"'),
        document.fonts.load('bold 24px "Hind Siliguri"'),
        document.fonts.load('bold 22px "Hind Siliguri"'),
        document.fonts.load('500 30px "Hind Siliguri"'),
        document.fonts.load('500 27px "Hind Siliguri"'),
        document.fonts.load('500 24px "Hind Siliguri"'),
      ]);
      await document.fonts.ready;
    }
  } catch (err) {
    console.warn('Font loading check:', err);
  }
}

// Preload image cleanly
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Draw circular cropped avatar at (centerX, centerY) with specified diameter
function drawCircularAvatar(
  ctx: CanvasRenderingContext2D,
  avatarImg: HTMLImageElement,
  centerX: number,
  centerY: number,
  diameter: number,
  borderWidth: number,
  outerRingWidth = 0
) {
  const radius = diameter / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(56, 27, 14, 0.14)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + outerRingWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Clip image inside circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const imgW = avatarImg.naturalWidth || avatarImg.width;
  const imgH = avatarImg.naturalHeight || avatarImg.height;
  const cropSize = Math.min(imgW, imgH);
  const sx = (imgW - cropSize) / 2;
  const sy = (imgH - cropSize) / 2;

  ctx.drawImage(
    avatarImg,
    sx,
    sy,
    cropSize,
    cropSize,
    centerX - radius,
    centerY - radius,
    diameter,
    diameter
  );
  ctx.restore();

  // Crisp tea-brown ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = '#8B4513';
  ctx.stroke();
}

/**
 * Generates an exact 1080 × 1350 PNG Blob and Data URL using Image 2 as the clean background template,
 * preserving all existing artwork and inserting dynamic game data plus optional player personalisation.
 */
export async function generateResultAssets({
  score,
  personality,
  playerName,
  profileImageUrl,
}: RenderOptions): Promise<GeneratedResultAssets> {
  await ensureFontsLoaded();

  const cleanName = (playerName || '').trim();
  const hasName = cleanName.length > 0;

  const templateImg = await loadImage(getTemplateImgSrc());
  let avatarImg: HTMLImageElement | null = null;
  if (profileImageUrl) {
    try {
      avatarImg = await loadImage(profileImageUrl);
    } catch (err) {
      console.warn('Could not load uploaded profile photo, skipping photo on card:', err);
      avatarImg = null;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context could not be created');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw Image 2 (Clean background template) as the fixed 1080 x 1350 background
  ctx.drawImage(templateImg, 0, 0, 1080, 1350);

  // -------------------------------------------------------------
  // 0. OPTIONAL PERSONALISATION (Centered cleanly in Y=74..140)
  // -------------------------------------------------------------
  const centerY = 107;

  if (avatarImg && hasName) {
    // Both profile photo & name: balanced centered pill
    const avatarDiameter = 48;
    const gap = 14;
    const padLeft = 10;
    const padRight = 24;
    const maxPillWidth = 540;
    const maxTextWidth = maxPillWidth - padLeft - avatarDiameter - gap - padRight;

    const fitted = fitSingleLineText(ctx, cleanName, maxTextWidth, 24, 18, 'bold');
    ctx.font = `bold ${fitted.fontSize}px "Hind Siliguri", sans-serif`;
    const textWidth = ctx.measureText(fitted.text).width;

    const pillW = Math.min(maxPillWidth, padLeft + avatarDiameter + gap + textWidth + padRight);
    const pillH = 60;
    const pillX = (1080 - pillW) / 2;
    const pillY = centerY - pillH / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(74, 38, 14, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#DFC6AD';
    ctx.stroke();

    const avatarCenterX = pillX + padLeft + avatarDiameter / 2;
    drawCircularAvatar(ctx, avatarImg, avatarCenterX, centerY, avatarDiameter, 2, 0);

    ctx.fillStyle = '#5C2C16';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fitted.fontSize}px "Hind Siliguri", sans-serif`;
    ctx.fillText(fitted.text, pillX + padLeft + avatarDiameter + gap, centerY + 1);
  } else if (avatarImg && !hasName) {
    // Only profile photo: clean centered circular frame
    drawCircularAvatar(ctx, avatarImg, 540, centerY, 64, 2.5, 3);
  } else if (!avatarImg && hasName) {
    // Only name: clean centered pill
    const padX = 28;
    const maxPillWidth = 520;
    const maxTextWidth = maxPillWidth - padX * 2;

    const fitted = fitSingleLineText(ctx, cleanName, maxTextWidth, 24, 18, 'bold');
    ctx.font = `bold ${fitted.fontSize}px "Hind Siliguri", sans-serif`;
    const textWidth = ctx.measureText(fitted.text).width;

    const pillW = Math.min(maxPillWidth, textWidth + padX * 2);
    const pillH = 48;
    const pillX = (1080 - pillW) / 2;
    const pillY = centerY - pillH / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(74, 38, 14, 0.07)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#DFC6AD';
    ctx.stroke();

    ctx.fillStyle = '#5C2C16';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitted.text, 540, centerY + 1);
  }

  // -------------------------------------------------------------
  // 1. LEVEL BADGE
  // -------------------------------------------------------------
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '76px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  const emojiMetrics = ctx.measureText(personality.emoji);
  const opticalY =
    emojiMetrics.actualBoundingBoxAscent && emojiMetrics.actualBoundingBoxDescent
      ? (emojiMetrics.actualBoundingBoxAscent - emojiMetrics.actualBoundingBoxDescent) / 2
      : 0;
  ctx.fillText(personality.emoji, 540, 412 + opticalY);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`লেভেল ${toBengaliDigits(personality.level)}`, 540, 513);

  // -------------------------------------------------------------
  // 2. PERSONALITY TITLE
  // -------------------------------------------------------------
  let titleFontSize = 52;
  const maxTitleWidth = 680;
  ctx.font = `bold ${titleFontSize}px "Hind Siliguri", sans-serif`;

  while (ctx.measureText(personality.title).width > maxTitleWidth && titleFontSize > 36) {
    titleFontSize -= 2;
    ctx.font = `bold ${titleFontSize}px "Hind Siliguri", sans-serif`;
  }

  ctx.fillStyle = '#7A3207';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(personality.title, 540, 600);

  // -------------------------------------------------------------
  // 3. TOTAL SCORE
  // -------------------------------------------------------------
  const bengaliScore = toBengaliDigits(score);
  ctx.fillStyle = '#7B3307';
  ctx.font = 'bold 64px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(bengaliScore, 590, 726);

  // -------------------------------------------------------------
  // 4. PROGRESS BAR
  // -------------------------------------------------------------
  const barX = 315;
  const barY = 753;
  const barW = 450;
  const barH = 26;
  const barR = 13;

  drawRoundedRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = '#E1D4C4';
  ctx.fill();

  const boundedScore = Math.min(100, Math.max(0, score));
  const fillW = (boundedScore / 100) * barW;

  if (fillW > 0) {
    ctx.save();
    drawRoundedRect(ctx, barX, barY, barW, barH, barR);
    ctx.clip();

    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#E08422');
    grad.addColorStop(1, '#622C0E');

    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, fillW, barH);
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 5. PERSONALITY DESCRIPTION
  // -------------------------------------------------------------
  const isLongDescription = personality.description.length > 115;
  const descFontSize = isLongDescription ? 27 : 30;
  const descLineHeight = isLongDescription ? 43 : 47;

  ctx.font = `500 ${descFontSize}px "Hind Siliguri", sans-serif`;
  ctx.fillStyle = '#793208';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const descLines = wrapText(ctx, personality.description, 720);
  const totalDescHeight = descLines.length * descLineHeight;
  const startDescY = 932 - totalDescHeight / 2 + descLineHeight / 2;

  descLines.forEach((line, idx) => {
    ctx.fillText(line, 540, startDescY + idx * descLineHeight);
  });

  // -------------------------------------------------------------
  // 6. SCORE RANGE
  // -------------------------------------------------------------
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '500 24px "Hind Siliguri", sans-serif';
  ctx.fillStyle = '#6E4733';
  const rangeText = `${toBengaliDigits(personality.minScore)}–${toBengaliDigits(personality.maxScore)} পয়েন্ট`;
  ctx.fillText(rangeText, 534, 1114);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });

  return {
    blob,
    dataUrl,
    filename: 'cha-khor-result.png',
  };
}

/**
 * Checks whether the current browser supports sharing the PNG file via Web Share API.
 */
export function canShareResultFile(blob: Blob, filename = 'cha-khor-result.png'): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function' ||
    typeof navigator.share !== 'function' ||
    typeof File === 'undefined'
  ) {
    return false;
  }

  try {
    const file = new File([blob], filename, { type: 'image/png' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Attempts to share the generated PNG image via Web Share API.
 */
export async function shareResultFile(
  blob: Blob,
  filename: string,
  score: number,
  personality: Personality
): Promise<'shared' | 'aborted' | 'unsupported' | 'failed'> {
  if (!canShareResultFile(blob, filename)) {
    return 'unsupported';
  }

  try {
    const file = new File([blob], filename, { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: 'আপনি কত বড় চা-খোর?',
      text: `আমি "আপনি কত বড় চা-খোর?" কুইজে ১০০-তে ${toBengaliDigits(score)} পেয়েছি! খেতাব: ${personality.title}`,
    });
    return 'shared';
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'aborted';
    }
    return 'failed';
  }
}

/**
 * Triggers standard browser anchor download using a Blob URL.
 * Does not assume the browser actually saved the file (important for in-app browsers).
 */
export function triggerBrowserDownload(blob: Blob, filename = 'cha-khor-result.png'): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke later so the browser has time to initiate the download
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 10000);
}
