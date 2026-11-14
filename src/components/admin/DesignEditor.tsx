"use client";

import { useState } from "react";
import type { EventConfig } from "@/lib/types";
import { FONTS } from "@/lib/defaults";
import { assetUrl, browserDb } from "@/lib/supabase/browser";
import { isVideo } from "@/lib/media";
import { btn, btnDanger, input, Panel, Text, Toggle } from "./ui";

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" />
      <span className="font-medium">{label}</span>
      <span className="ml-auto font-mono text-xs text-slate-500">{value}</span>
    </label>
  );
}

export function DesignEditor({ eventId, config, onChange }: { eventId: string; config: EventConfig; onChange: (c: EventConfig) => void }) {
  const { theme, header } = config;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const setTheme = (patch: Partial<EventConfig["theme"]>) => onChange({ ...config, theme: { ...theme, ...patch } });
  const setHeader = (patch: Partial<EventConfig["header"]>) => onChange({ ...config, header: { ...header, ...patch } });

  async function upload(file: File | undefined) {
    if (!file) return null;
    setError("");
    setUploading(true);
    const path = `${eventId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
    const { error } = await browserDb().storage.from("assets").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) {
      setError(
        /mime type/i.test(error.message) ? `This file type (${file.type || "unknown"}) isn't allowed yet. Video banners need the storage update from the setup guide.`
        : /size/i.test(error.message) ? "That file is too big. Please use a smaller or more compressed file."
        : error.message,
      );
      return null;
    }
    return assetUrl(path);
  }

  return (
    <div className="space-y-4">
      <Panel title="Opening animation">
        <Toggle label="Play an opening animation on the registration form" checked={config.intro.enabled} onChange={(enabled) => onChange({ ...config, intro: { ...config.intro, enabled } })}
          hint="Logos and event name appear in the middle of the screen, then move up to the header and the form appears. Visitors can tap to skip." />
        {config.intro.enabled && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">Show in the middle for</span>
            <input type="number" min={1} max={8} step={0.5} value={config.intro.seconds} onChange={(e) => onChange({ ...config, intro: { ...config.intro, seconds: Math.min(8, Math.max(1, Number(e.target.value) || 3)) } })} className={`${input} max-w-20`} />
            <span className="text-slate-600">seconds</span>
          </label>
        )}
        <p className="text-xs text-slate-500">The preview here doesn&apos;t play it. Save, then use <b>Open form ↗</b> to watch it.</p>
      </Panel>
      <Panel title="Header text">
        <Text label="Date / time line" value={header.subtitle} onChange={(subtitle) => setHeader({ subtitle })} />
        <Text label="Venue line" value={header.venue} onChange={(venue) => setHeader({ venue })} />
      </Panel>

      <Panel title="Colors & font">
        <Color label="Accent (buttons, highlights)" value={theme.primary} onChange={(primary) => setTheme({ primary })} />
        <Color label="Header background" value={theme.headerBg} onChange={(headerBg) => setTheme({ headerBg })} />
        <Color label="Header text" value={theme.headerText} onChange={(headerText) => setTheme({ headerText })} />
        <Color label="Page background" value={theme.pageBg} onChange={(pageBg) => setTheme({ pageBg })} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Font</span>
          <select value={theme.font} onChange={(e) => setTheme({ font: e.target.value })} className={input}>
            {FONTS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
      </Panel>

      <Panel title="Images">
        <div className="text-sm">
          <p className="mb-1 font-medium text-slate-700">Header banner (image, GIF or video)</p>
          {theme.bannerUrl && (isVideo(theme.bannerUrl) ? (
            <video src={theme.bannerUrl} autoPlay muted loop playsInline className="mb-2 h-24 w-full rounded-lg object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.bannerUrl} alt="Banner" className="mb-2 h-24 w-full rounded-lg object-cover" />
          ))}
          <div className="flex gap-2">
            <label className={`${btn} cursor-pointer`}>
              {theme.bannerUrl ? "Replace" : "Upload"} banner
              <input type="file" accept="image/*,video/mp4,video/webm" className="sr-only" onChange={async (e) => { const url = await upload(e.target.files?.[0]); if (url) setTheme({ bannerUrl: url }); e.target.value = ""; }} />
            </label>
            {theme.bannerUrl && <button type="button" className={btnDanger} onClick={() => setTheme({ bannerUrl: "" })}>Remove</button>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Videos (MP4 or WebM) play silently on a loop. Keep them short and under about 10MB so phones load them quickly (max 50MB).</p>
        </div>
        {theme.bannerUrl && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">Banner overlay (tint that keeps the text readable)</p>
            <Color label="Overlay color" value={theme.overlayColor} onChange={(overlayColor) => setTheme({ overlayColor })} />
            <label className="flex items-center gap-3">
              <span className="font-medium">Opacity</span>
              <input type="range" min={0} max={100} step={5} value={theme.overlayOpacity} onChange={(e) => setTheme({ overlayOpacity: Number(e.target.value) })} className="flex-1 accent-blue-600" />
              <span className="w-10 text-right font-mono text-xs text-slate-500">{theme.overlayOpacity}%</span>
            </label>
          </div>
        )}
        <div className="text-sm">
          <p className="mb-1 font-medium text-slate-700">Logos (shown above the title)</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {theme.logoUrls.map((src) => (
              <div key={src} className="relative rounded-lg border border-slate-200 bg-slate-100 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Logo" className="h-14 w-auto" />
                <button type="button" aria-label="Remove logo" onClick={() => setTheme({ logoUrls: theme.logoUrls.filter((u) => u !== src) })} className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-xs text-white">×</button>
              </div>
            ))}
          </div>
          <label className={`${btn} inline-block cursor-pointer`}>
            + Add logo
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const url = await upload(e.target.files?.[0]); if (url) setTheme({ logoUrls: [...theme.logoUrls, url] }); e.target.value = ""; }} />
          </label>
        </div>
        {uploading && <p className="text-sm text-slate-500">Uploading…</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </Panel>

      <Panel title="Success page (after submitting)">
        <Text label="Thank-you message" textarea value={config.successMessage} onChange={(successMessage) => onChange({ ...config, successMessage })} />
        <Text label='"What happens next" box (one point per line; leave empty to hide)' textarea value={config.successNextSteps} onChange={(successNextSteps) => onChange({ ...config, successNextSteps })} />
        <p className="-mt-2 text-xs text-slate-500">Tip: switch the preview to <b>Success page</b> to see these.</p>
      </Panel>
      <Panel title="Footer">
        <Text label="Footer (press Enter for a new line)" textarea value={config.footer} onChange={(footer) => onChange({ ...config, footer })} />
      </Panel>
    </div>
  );
}
