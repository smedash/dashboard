/**
 * Converts a Vercel Blob URL into an authenticated download URL
 * that goes through our /api/files/download proxy.
 *
 * This is needed because blobs are stored with access: "private"
 * and require authentication to download.
 */
export function getAuthenticatedBlobUrl(blobUrl: string | null): string {
  if (!blobUrl) return "";
  return `/api/files/download?url=${encodeURIComponent(blobUrl)}`;
}
