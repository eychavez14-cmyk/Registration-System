"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a QR code image in the browser (no network request).
export function QrCode({ value, size = 160, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setSrc, () => setSrc(""));
  }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={label} width={size} height={size} className="rounded-lg bg-white p-1" /> : <div style={{ width: size, height: size }} className="rounded-lg bg-slate-100" />;
}
