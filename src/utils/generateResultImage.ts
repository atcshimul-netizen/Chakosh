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
  blobUrl: string;
  dataUrl: string;
  filename: string;
  downloadUrl?: string;
  imageUrl?: string;
  id?: string;
  backend?: 'express' | 'php';
}

// Background template image (Image 2: Clean background template)
const getTemplateImgSrc = () => getPublicAssetUrl('assets/aistudio/1a_2ae07336.jpg');

// Robust Bengali font stack with Apple/iOS native font fallbacks
const BENGALI_FONT_STACK =
  '"Hind Siliguri", "Kohinoor Bangla", "Bangla Sangam MN", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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

  const readViaFileReader = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result) {
          resolve(reader.result);
        } else {
          reject(new Error('ছবিটি পড়া সম্ভব হয়নি।'));
        }
      };
      reader.onerror = () => reject(new Error('ছবিটি পড়া সম্ভব হয়নি।'));
      reader.readAsDataURL(file);
    });

  const objectUrl = URL.createObjectURL(file);
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(objectUrl);
    } catch {
      const fallbackDataUrl = await readViaFileReader();
      img = await loadImage(fallbackDataUrl);
    }

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

// Helper to draw rectangle with rounded top corners and square bottom corners
function drawTopRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  topRadius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + topRadius, y);
  ctx.lineTo(x + w - topRadius, y);
  ctx.arcTo(x + w, y, x + w, y + topRadius, topRadius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + topRadius);
  ctx.arcTo(x, y, x + w, y, topRadius);
  ctx.closePath();
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
  ctx.font = `${fontWeight} ${fontSize}px ${BENGALI_FONT_STACK}`;

  while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
    fontSize -= 1;
    ctx.font = `${fontWeight} ${fontSize}px ${BENGALI_FONT_STACK}`;
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

// Ensure web fonts are loaded before measuring or rendering (with timeout guard)
async function ensureFontsLoaded(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && document.fonts) {
      if (typeof document.fonts.load === 'function') {
        const fontTask = Promise.all([
          document.fonts.load('700 64px "Hind Siliguri"'),
          document.fonts.load('bold 64px "Hind Siliguri"'),
          document.fonts.load('700 52px "Hind Siliguri"'),
          document.fonts.load('bold 52px "Hind Siliguri"'),
          document.fonts.load('700 44px "Hind Siliguri"'),
          document.fonts.load('700 28px "Hind Siliguri"'),
          document.fonts.load('700 26px "Hind Siliguri"'),
          document.fonts.load('700 22px "Hind Siliguri"'),
          document.fonts.load('bold 22px "Hind Siliguri"'),
          document.fonts.load('600 24px "Hind Siliguri"'),
          document.fonts.load('500 30px "Hind Siliguri"'),
          document.fonts.load('500 27px "Hind Siliguri"'),
          document.fonts.load('500 24px "Hind Siliguri"'),
          document.fonts.load('400 24px "Hind Siliguri"'),
        ]);
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
        await Promise.race([fontTask, timeout]);
      }
      if (document.fonts.ready) {
        const readyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
        await Promise.race([document.fonts.ready, readyTimeout]);
      }
    }
  } catch (err) {
    console.warn('Font loading check:', err);
  }
}

// Preload and decode image cleanly
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Ignore decode rejection if image is already usable
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Draw cover-cropped photo inside the level badge white box (448..631 x 341..488)
function drawBadgePhoto(ctx: CanvasRenderingContext2D, photoImg: HTMLImageElement) {
  const boxX = 448;
  const boxY = 341;
  const boxW = 183;
  const boxH = 147;
  const topRadius = 21;

  const imgW = photoImg.naturalWidth || photoImg.width;
  const imgH = photoImg.naturalHeight || photoImg.height;
  if (!imgW || !imgH) return;

  // Cover-crop without distorting aspect ratio
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const srcW = boxW / scale;
  const srcH = boxH / scale;
  const sx = (imgW - srcW) / 2;
  const sy = (imgH - srcH) / 2;

  ctx.save();
  drawTopRoundedRect(ctx, boxX, boxY, boxW, boxH, topRadius);
  ctx.clip();
  ctx.drawImage(photoImg, sx, sy, srcW, srcH, boxX, boxY, boxW, boxH);
  ctx.restore();
}

/**
 * Generates an exact 1080 × 1350 PNG Blob and Data URL using Image 2 as the clean background template,
 * preserving all existing artwork and inserting dynamic game data plus optional player personalisation.
 *
 * Uses explicit left-aligned coordinate mathematics (x = Math.round(targetX - width / 2)) to guarantee
 * 100% pixel-perfect text placement across all iOS Safari (WebKit), Android, and Desktop platforms.
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
  // Enforce LTR and left-alignment globally; explicit coordinates prevent iOS WebKit alignment bugs
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';

  // 1. Draw Image 2 (Clean background template) as the fixed 1080 x 1350 background
  ctx.drawImage(templateImg, 0, 0, 1080, 1350);

  // -------------------------------------------------------------
  // 1. LEVEL BADGE (Photo replaces emoji; User Name replaces Level)
  // -------------------------------------------------------------
  if (avatarImg) {
    drawBadgePhoto(ctx, avatarImg);
  } else {
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    ctx.font = '76px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

    const emojiMetrics = ctx.measureText(personality.emoji);
    const opticalY =
      emojiMetrics.actualBoundingBoxAscent && emojiMetrics.actualBoundingBoxDescent
        ? (emojiMetrics.actualBoundingBoxAscent - emojiMetrics.actualBoundingBoxDescent) / 2
        : 0;
    const emojiX = Math.round(540 - emojiMetrics.width / 2);
    ctx.fillText(personality.emoji, emojiX, 412 + opticalY);
  }

  if (hasName) {
    const ribbonInnerMaxW = 170;
    ctx.font = `bold 22px ${BENGALI_FONT_STACK}`;
    const naturalNameW = ctx.measureText(cleanName).width;

    if (naturalNameW <= ribbonInnerMaxW) {
      // Fits directly inside the template's original brown ribbon
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.textBaseline = 'middle';
      const nameX = Math.round(540 - naturalNameW / 2);
      ctx.fillText(cleanName, nameX, 514);
    } else {
      // Smoothly expand a matching brown ribbon horizontally for longer names
      const maxExpandedW = 460;
      const ribbonPadX = 28;
      const fitted = fitSingleLineText(
        ctx,
        cleanName,
        maxExpandedW - ribbonPadX * 2,
        22,
        17,
        'bold'
      );
      ctx.font = `bold ${fitted.fontSize}px ${BENGALI_FONT_STACK}`;
      const textW = ctx.measureText(fitted.text).width;
      const ribbonW = Math.max(194, Math.min(maxExpandedW, textW + ribbonPadX * 2));
      const ribbonX = Math.round(540 - ribbonW / 2);
      const ribbonY = 488;
      const ribbonH = 56;

      ctx.save();
      ctx.shadowColor = 'rgba(74, 38, 14, 0.14)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      drawRoundedRect(ctx, ribbonX, ribbonY, ribbonW, ribbonH, 16);
      ctx.fillStyle = '#8F3F0A';
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fitted.fontSize}px ${BENGALI_FONT_STACK}`;
      const textX = Math.round(540 - textW / 2);
      ctx.fillText(fitted.text, textX, 515);
    }
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 22px ${BENGALI_FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.textBaseline = 'middle';
    const levelText = `লেভেল ${toBengaliDigits(personality.level)}`;
    const levelW = ctx.measureText(levelText).width;
    const levelX = Math.round(540 - levelW / 2);
    ctx.fillText(levelText, levelX, 513);
  }

  // -------------------------------------------------------------
  // 2. PERSONALITY TITLE (Centered manually at x = 540)
  // -------------------------------------------------------------
  let titleFontSize = 52;
  const maxTitleWidth = 680;
  ctx.font = `bold ${titleFontSize}px ${BENGALI_FONT_STACK}`;

  while (ctx.measureText(personality.title).width > maxTitleWidth && titleFontSize > 36) {
    titleFontSize -= 2;
    ctx.font = `bold ${titleFontSize}px ${BENGALI_FONT_STACK}`;
  }

  ctx.fillStyle = '#7A3207';
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'middle';
  const titleW = ctx.measureText(personality.title).width;
  const titleX = Math.round(540 - titleW / 2);
  ctx.fillText(personality.title, titleX, 600);

  // -------------------------------------------------------------
  // 3. TOTAL SCORE (Right edge aligned manually at x = 590)
  // -------------------------------------------------------------
  const bengaliScore = toBengaliDigits(score);
  ctx.fillStyle = '#7B3307';
  ctx.font = `bold 64px ${BENGALI_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'alphabetic';
  const scoreW = ctx.measureText(bengaliScore).width;
  const scoreX = Math.round(590 - scoreW);
  ctx.fillText(bengaliScore, scoreX, 726);

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
  // 5. PERSONALITY DESCRIPTION (Safely centered within quote box)
  // -------------------------------------------------------------
  const isLongDescription = personality.description.length > 115;
  const descFontSize = isLongDescription ? 27 : 30;
  const descLineHeight = isLongDescription ? 43 : 47;

  ctx.font = `500 ${descFontSize}px ${BENGALI_FONT_STACK}`;
  ctx.fillStyle = '#793208';
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'middle';

  // Safe inner width of 640px ensures lines stay clear of quote ornaments
  const descLines = wrapText(ctx, personality.description, 640);
  const totalDescHeight = descLines.length * descLineHeight;
  const startDescY = 932 - totalDescHeight / 2 + descLineHeight / 2;

  descLines.forEach((line, idx) => {
    const lineW = ctx.measureText(line).width;
    const lineX = Math.round(540 - lineW / 2);
    ctx.fillText(line, lineX, startDescY + idx * descLineHeight);
  });

  // -------------------------------------------------------------
  // 6. SCORE RANGE
  // -------------------------------------------------------------
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 24px ${BENGALI_FONT_STACK}`;
  ctx.fillStyle = '#6E4733';
  const rangeText = `${toBengaliDigits(personality.minScore)}–${toBengaliDigits(personality.maxScore)} পয়েন্ট`;
  ctx.fillText(rangeText, 534, 1114);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
        return;
      }
      try {
        const base64 = dataUrl.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch {
        reject(new Error('Canvas toBlob failed'));
      }
    }, 'image/png');
  });

  const blobUrl = URL.createObjectURL(blob);

  return {
    blob,
    blobUrl,
    dataUrl,
    filename: 'chakosh-result.png',
  };
}

/**
 * Checks whether the current browser supports sharing the PNG file via Web Share API.
 */
export function canShareResultFile(blob: Blob, filename = 'chakosh-result.png'): boolean {
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
export const DEFAULT_QUIZ_URL = 'https://chakosh.nisorgo.com/koto-boro-chakhor/';

/**
 * Attempts to share the generated PNG image via Web Share API.
 */
export async function shareResultFile(
  blob: Blob,
  filename: string,
  score: number,
  personality: Personality,
  shareUrl = DEFAULT_QUIZ_URL
): Promise<'shared' | 'aborted' | 'unsupported' | 'failed'> {
  if (!canShareResultFile(blob, filename)) {
    return 'unsupported';
  }

  const caption = `আমি "আপনি কত বড় চা-খোর?" কুইজে ১০০-তে ${toBengaliDigits(score)} পেয়েছি! খেতাব: ${personality.title}।\n\nআপনি কত বড় চা-খোর? আপনার স্কোর চেক করতে এখানে খেলুন:\n${shareUrl}`;

  try {
    const file = new File([blob], filename, { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: 'আপনি কত বড় চা-খোর?',
      text: caption,
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
export function triggerBrowserDownload(blob: Blob, filename = 'chakosh-result.png'): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Keep link briefly and revoke Blob URL later so mobile browsers complete the download
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 1500);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 30000);
}
