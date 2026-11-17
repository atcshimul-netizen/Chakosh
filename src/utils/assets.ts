/**
 * Resolves a public-folder asset path using Vite's configured BASE_URL
 * (e.g. `/koto-boro-chakhor/` in production builds, `/` in local dev).
 */
export function getPublicAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = relativePath.startsWith('/')
    ? relativePath.slice(1)
    : relativePath;
  return `${normalizedBase}${normalizedPath}`;
}
