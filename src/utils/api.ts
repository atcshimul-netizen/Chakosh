export interface UploadResultResponse {
  success: boolean;
  id: string;
  downloadUrl: string;
  imageUrl?: string;
  filename: string;
  expiresInMinutes: number;
  backend?: 'express' | 'php';
}

async function postImageToEndpoint(
  endpoint: string,
  blob: Blob,
  timeoutMs: number
): Promise<UploadResultResponse> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
      },
      body: blob,
      signal: controller?.signal,
    });
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    let errorMsg = `Server error ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data: UploadResultResponse = await response.json();
  if (!data || !data.success || !data.downloadUrl || !data.id) {
    throw new Error('Invalid response structure received from storage endpoint');
  }

  // Construct absolute URLs so WebView/browser handles them cleanly
  const absoluteDownloadUrl = data.downloadUrl.startsWith('http')
    ? data.downloadUrl
    : new URL(data.downloadUrl, window.location.origin).href;

  const absoluteImageUrl = data.imageUrl
    ? data.imageUrl.startsWith('http')
      ? data.imageUrl
      : new URL(data.imageUrl, window.location.origin).href
    : undefined;

  return {
    ...data,
    downloadUrl: absoluteDownloadUrl,
    imageUrl: absoluteImageUrl,
    backend: data.backend || (endpoint.endsWith('.php') ? 'php' : 'express'),
  };
}

/**
 * Uploads the generated result card image blob to the server's temporary storage endpoint.
 * Tries the Express/rewritten route `/api/result-image` first, and automatically falls back
 * to `/api/result-image.php` for static/PHP hosting (e.g. Hostinger subdirectories).
 */
export async function uploadResultImage(blob: Blob): Promise<UploadResultResponse> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const primaryEndpoint = `${base}/api/result-image`;
  const phpFallbackEndpoint = `${base}/api/result-image.php`;

  try {
    return await postImageToEndpoint(primaryEndpoint, blob, 6500);
  } catch (primaryErr) {
    // Fall back directly to the physical PHP endpoint if /api/result-image is not routed
    return await postImageToEndpoint(phpFallbackEndpoint, blob, 10000);
  }
}
