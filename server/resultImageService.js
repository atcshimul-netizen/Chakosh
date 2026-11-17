import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
export const EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes TTL
export const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute cleanup interval
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB max
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const ID_REGEX = /^[a-f0-9]{48}$/i;

// Temporary disk directory for holding prepared result images
export const TEMP_DIR = path.resolve(__dirname, '..', '.temp-downloads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// In-memory index of creation times: Map<id, { createdAt: number, filePath: string }>
const metadataStore = new Map();

// Synchronize initial state with files currently in TEMP_DIR
function syncInitialFiles() {
  const now = Date.now();
  try {
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      const id = file.slice(0, -4);
      if (!ID_REGEX.test(id)) continue;

      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > EXPIRATION_MS) {
          fs.unlinkSync(filePath);
        } else {
          metadataStore.set(id, {
            createdAt: stat.mtimeMs,
            filePath,
          });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Initial sync warning for temp downloads:', err);
  }
}
syncInitialFiles();

/**
 * Checks whether an image identifier is expired (>10 minutes).
 * If expired and file exists, physically deletes it immediately.
 */
export function isExpired(id) {
  const record = metadataStore.get(id);
  if (!record) {
    // Check if file exists on disk
    const filePath = path.join(TEMP_DIR, `${id}.png`);
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > EXPIRATION_MS) {
          fs.unlinkSync(filePath);
          return true;
        }
        metadataStore.set(id, { createdAt: stat.mtimeMs, filePath });
        return false;
      } catch {
        return true;
      }
    }
    return true;
  }

  if (Date.now() - record.createdAt > EXPIRATION_MS) {
    deleteFile(id);
    return true;
  }
  return false;
}

/**
 * Removes file from memory map and filesystem.
 */
export function deleteFile(id) {
  metadataStore.delete(id);
  const filePath = path.join(TEMP_DIR, `${id}.png`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`Failed to unlink temp file ${id}.png:`, err);
  }
}

/**
 * Periodic cleanup sweep running every 60 seconds.
 * Maximum deletion delay after the 10-minute expiration mark is 60 seconds.
 */
export function sweepExpiredFiles() {
  const now = Date.now();
  for (const [id, record] of metadataStore.entries()) {
    if (now - record.createdAt > EXPIRATION_MS) {
      deleteFile(id);
    }
  }

  try {
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      const id = file.slice(0, -4);
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > EXPIRATION_MS) {
          deleteFile(id);
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error during temp file sweep:', err);
  }
}

const cleanupInterval = setInterval(sweepExpiredFiles, CLEANUP_INTERVAL_MS);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Validates PNG data and writes to disk under an unguessable 48-char hex identifier.
 */
export function saveResultImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Image payload is empty or invalid.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image size exceeds 15 MB limit.');
  }
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Image is not a valid PNG format.');
  }

  // 24 cryptographically random bytes = 48-character unguessable hex string
  const id = crypto.randomBytes(24).toString('hex');
  const filePath = path.join(TEMP_DIR, `${id}.png`);

  fs.writeFileSync(filePath, buffer);
  metadataStore.set(id, {
    createdAt: Date.now(),
    filePath,
  });

  return id;
}

/**
 * Handles POST /api/result-image
 */
async function handleUploadReq(req, res) {
  try {
    let buffer = null;

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
    } else if (req.body && typeof req.body === 'object' && typeof req.body.imageData === 'string') {
      const base64 = req.body.imageData.replace(/^data:image\/png;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    } else {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      if (raw.length >= 8 && raw.subarray(0, 8).equals(PNG_SIGNATURE)) {
        buffer = raw;
      } else {
        try {
          const parsed = JSON.parse(raw.toString('utf8'));
          if (parsed && typeof parsed.imageData === 'string') {
            const base64 = parsed.imageData.replace(/^data:image\/png;base64,/, '');
            buffer = Buffer.from(base64, 'base64');
          }
        } catch {
          buffer = raw;
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'No image data received' }));
      return;
    }

    const id = saveResultImageBuffer(buffer);

    const hasSubpath = (req.url || '').includes('/koto-boro-chakhor');
    const basePath = hasSubpath ? '/koto-boro-chakhor' : '';
    const downloadUrl = `${basePath}/api/download/${id}`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      success: true,
      id,
      downloadUrl,
      imageUrl: `${basePath}/api/image/${id}`,
      filename: 'chakosh-result.png',
      expiresInMinutes: 10,
    }));
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      error: err instanceof Error ? err.message : 'Failed to store image'
    }));
  }
}

/**
 * Handles GET /api/download/:id
 */
function handleDownloadReq(req, res, id) {
  if (!id || !ID_REGEX.test(id)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Invalid download ID format' }));
    return;
  }

  // Reject expired URLs immediately
  if (isExpired(id)) {
    res.statusCode = 410; // HTTP 410 Gone
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      error: 'This download link has expired (10-minute limit).',
      expired: true,
    }));
    return;
  }

  const filePath = path.join(TEMP_DIR, `${id}.png`);
  if (!fs.existsSync(filePath)) {
    metadataStore.delete(id);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Image not found' }));
    return;
  }

  const stat = fs.statSync(filePath);

  // Exact required headers
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', 'attachment; filename="chakosh-result.png"');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

/**
 * Handles GET /api/image/:id (inline display without attachment header)
 */
function handleImageInlineReq(req, res, id) {
  if (!id || !ID_REGEX.test(id)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Invalid image ID format' }));
    return;
  }

  if (isExpired(id)) {
    res.statusCode = 410;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'This image has expired', expired: true }));
    return;
  }

  const filePath = path.join(TEMP_DIR, `${id}.png`);
  if (!fs.existsSync(filePath)) {
    metadataStore.delete(id);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Image not found' }));
    return;
  }

  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

/**
 * Unified Connect / Express middleware for download and upload routes
 */
export function resultImageMiddleware(req, res, next) {
  const url = req.url || '';
  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (req.method === 'POST' && (pathname === '/api/result-image' || pathname === '/koto-boro-chakhor/api/result-image')) {
    handleUploadReq(req, res);
    return;
  }

  const downloadMatch = pathname.match(/^(?:\/koto-boro-chakhor)?\/api\/download\/(.+)$/i);
  if (req.method === 'GET' && downloadMatch) {
    handleDownloadReq(req, res, downloadMatch[1]);
    return;
  }

  const imageMatch = pathname.match(/^(?:\/koto-boro-chakhor)?\/api\/image\/(.+)$/i);
  if (req.method === 'GET' && imageMatch) {
    handleImageInlineReq(req, res, imageMatch[1]);
    return;
  }

  if (typeof next === 'function') {
    next();
  }
}

/**
 * Vite plugin integration
 */
export function resultImageVitePlugin() {
  return {
    name: 'result-image-storage',
    configureServer(server) {
      server.middlewares.use(resultImageMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(resultImageMiddleware);
    },
  };
}

/**
 * Express integration
 */
export function registerResultImageRoutes(app) {
  app.use(resultImageMiddleware);
}
