"use client";

import { useEffect, useRef } from "react";
import jsQR from "jsqr";
import { extractCode } from "@/lib/qr";

// Live camera QR scanner. Calls onCode once with the registration number it finds, then stops itself.
export function QrScanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  // Keep the latest callbacks without restarting the camera on every render.
  const cb = useRef({ onCode, onError });
  useEffect(() => { cb.current = { onCode, onError }; });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0, last = 0, stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const tick = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const v = video.current;
      if (!v || v.readyState < 2 || t - last < 120) return; // ~8 scans a second is plenty and saves battery
      last = t;
      const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w) || 360; // downscale: faster, still reads fine
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(v, 0, 0, w, h);
      const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      const code = found && extractCode(found.data);
      if (code) {
        stopped = true;
        cb.current.onCode(code);
      }
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      cb.current.onError("This browser can't use the camera here. Use the live (https) site in Chrome or Safari, or type the number instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.current!.srcObject = s;
        video.current!.play().catch(() => {});
        raf = requestAnimationFrame(tick);
      })
      .catch((e: DOMException) =>
        cb.current.onError(
          e.name === "NotAllowedError" ? "Camera access was blocked. Allow the camera for this site in your browser settings, then try again."
          : e.name === "NotFoundError" ? "No camera was found on this device."
          : "Couldn't start the camera: " + e.message,
        ),
      );
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
      <video ref={video} muted playsInline className="h-full w-full object-cover" />
      {/* aiming frame */}
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white drop-shadow">Point at the QR code</p>
    </div>
  );
}
