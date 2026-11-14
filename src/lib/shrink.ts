// Shrinks a receipt photo in the browser before upload (typ. 1-5MB -> ~100-300KB) to save storage.
const MAX_SIDE = 1600; // long edge in px; receipt text stays readable at this size
const QUALITY = 0.8;

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file; // PDFs untouched
  try {
    const img = await createImageBitmap(file); // applies phone photo rotation (EXIF)
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#fff"; // transparent PNG areas would turn black in JPEG
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // can't decode: upload the original; the server still enforces type and size
  }
}
