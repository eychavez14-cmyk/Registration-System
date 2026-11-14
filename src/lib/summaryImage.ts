import type { EventConfig } from "./types";
import type { SummaryGroup } from "./summary";
import QRCode from "qrcode";

type Input = { title: string; config: EventConfig; refCode: string; date: string; groups: SummaryGroup[]; statusUrl: string };

const W = 1080; // phone-friendly width; text is sized to stay readable when viewed in a gallery app
const PAD = 64;
const QR = 360; // px; large enough to scan from a phone screen at arm's length

// Draws the registration summary (with its check-in QR code) onto a canvas and returns a PNG.
export async function summaryPng({ title, config, refCode, date, groups, statusUrl }: Input): Promise<Blob> {
  const { theme, header } = config;
  const family = `"${theme.font}", system-ui, sans-serif`;
  await Promise.all([400, 700].map((w) => document.fonts.load(`${w} 32px "${theme.font}"`).catch(() => null)));
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, statusUrl, { width: QR, margin: 2, errorCorrectionLevel: "M" });

  // Pass 1 measures height, pass 2 draws: same code path so layout can't drift.
  const layout = (g: CanvasRenderingContext2D, draw: boolean) => {
    const font = (size: number, weight = 400, fam = family) => (g.font = `${weight} ${size}px ${fam}`);
    const wrap = (text: string, max: number) => {
      const lines: string[] = [];
      for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (g.measureText(next).width > max && line) { lines.push(line); line = word; } else line = next;
        }
        lines.push(line);
      }
      return lines;
    };
    const text = (s: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") => {
      if (!draw) return;
      g.fillStyle = color;
      g.textAlign = align;
      g.fillText(s, x, y);
    };

    // Header band in the event's colors
    font(52, 700);
    const titleLines = wrap(title, W - PAD * 2);
    const sub = [header.subtitle, header.venue].filter(Boolean);
    const headerH = PAD + titleLines.length * 64 + sub.length * 40 + PAD - 16;
    if (draw) { g.fillStyle = theme.headerBg; g.fillRect(0, 0, W, headerH); }
    let y = PAD + 48;
    titleLines.forEach((l) => { font(52, 700); text(l, PAD, y, theme.headerText); y += 64; });
    sub.forEach((l) => { font(30); text(l, PAD, y, theme.headerText); y += 40; });
    y = headerH + 56;

    // QR code (scanned at check-in), then the registration number
    if (draw) g.drawImage(qr, (W - QR) / 2, y);
    y += QR + 48;
    font(26, 700); text("REGISTRATION NUMBER", W / 2, y, "#64748b", "center"); y += 92;
    font(84, 700, "ui-monospace, Menlo, Consolas, monospace"); text(refCode, W / 2, y, theme.primary, "center"); y += 56;
    font(28); text(`Submitted ${date} · Pending verification`, W / 2, y, "#64748b", "center"); y += 44;
    font(28, 600); text("Show this QR code at check-in", W / 2, y, "#334155", "center"); y += 64;

    // Details
    const labelW = 380, valueX = PAD + labelW + 24, valueW = W - valueX - PAD;
    for (const grp of groups) {
      if (draw) { g.fillStyle = "#e2e8f0"; g.fillRect(PAD, y, W - PAD * 2, 2); }
      y += 56;
      font(26, 700); text(grp.title.toUpperCase(), PAD, y, "#64748b"); y += 48;
      for (const [label, value] of grp.rows) {
        const isTotal = grp.title === "Payment" && label === "Total";
        font(30); const lLines = wrap(label, labelW);
        font(30, isTotal ? 700 : 600); const vLines = wrap(value, valueW);
        lLines.forEach((l, i) => { font(30); text(l, PAD, y + i * 40, "#475569"); });
        vLines.forEach((l, i) => { font(isTotal ? 34 : 30, isTotal ? 700 : 600); text(l, valueX, y + i * 40, isTotal ? theme.primary : "#0f172a"); });
        y += Math.max(lLines.length, vLines.length) * 40 + 14;
      }
      y += 8;
    }

    // Footer
    y += 24;
    if (draw) { g.fillStyle = "#f1f5f9"; g.fillRect(0, y, W, 2000); }
    y += 56;
    font(26); wrap(`Check your registration status anytime: ${statusUrl}`, W - PAD * 2).forEach((l) => { text(l, W / 2, y, "#475569", "center"); y += 36; });
    return y + 40;
  };

  const measure = document.createElement("canvas").getContext("2d")!;
  const H = layout(measure, false);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  layout(g, true);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not create image");
  return blob;
}
