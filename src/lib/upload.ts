import { assetUrl, browserDb } from "./supabase/browser";

// Uploads an admin image/video (banner, logo, payment QR) to the public assets bucket.
export async function uploadAsset(eventId: string, file: File): Promise<{ url: string } | { error: string }> {
  const path = `${eventId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
  const { error } = await browserDb().storage.from("assets").upload(path, file, { contentType: file.type });
  if (!error) return { url: assetUrl(path) };
  return {
    error: /mime type/i.test(error.message) ? `This file type (${file.type || "unknown"}) isn't allowed. Use an image (PNG, JPG, GIF, WebP) or an MP4/WebM video.`
      : /size/i.test(error.message) ? "That file is too big. Please use a smaller or more compressed file."
      : error.message,
  };
}
