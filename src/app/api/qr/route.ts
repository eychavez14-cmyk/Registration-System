import QRCode from "qrcode";
import { statusLink } from "@/lib/qr";

// PNG QR code for emails. It only encodes a link built from the inputs, so nothing private is looked up.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const slug = url.searchParams.get("slug") ?? "";
  if (!/^REG-[A-Z0-9]{6}$/.test(code) || !/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("Bad request", { status: 400 });
  const png = await QRCode.toBuffer(statusLink(url.origin, slug, code), { width: 480, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}
