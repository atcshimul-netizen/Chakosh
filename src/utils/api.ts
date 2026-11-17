export interface UploadResultResponse {
  success: boolean;
  id: string;
  downloadUrl: string;
  filename: string;
  expiresInMinutes: number;
}

/**
 * Uploads the generated result card image blob to the server's temporary storage endpoint.
 * Returns the unique unguessable identifier and real HTTPS download URL.
 */
export async function uploadResultImage(blob: Blob): Promise<UploadResultResponse> {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const endpoint = `${base}/api/result-image`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
    },
    body: blob,
  });

  if (!response.ok) {
    let errorMsg = `Server error ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data: UploadResultResponse = await response.json();
  if (!data.success || !data.downloadUrl || !data.id) {
    throw new Error('Invalid response structure received from storage endpoint');
  }

  // Construct absolute URL so WebView/browser treats it cleanly
  const absoluteDownloadUrl = data.downloadUrl.startsWith('http')
    ? data.downloadUrl
    : new URL(data.downloadUrl, window.location.origin).href;

  return {
    ...data,
    downloadUrl: absoluteDownloadUrl,
  };
}
