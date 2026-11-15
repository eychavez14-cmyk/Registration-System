import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { EventRow } from "@/lib/types";
import { HeaderIntro } from "./HeaderIntro";
import { isVideo } from "@/lib/media";

// Themed page frame shared by the form, the status page and the admin live preview.
// intro: play the opening animation (registration form page only, if enabled for the event).
export function EventShell({ event, tab, children, intro }: { event: Pick<EventRow, "slug" | "title" | "config">; tab: "form" | "status"; children: ReactNode; intro?: boolean }) {
  const { theme, header, footer } = event.config;
  const style = {
    "--primary": theme.primary,
    backgroundColor: theme.pageBg,
    fontFamily: `"${theme.font}", system-ui, sans-serif`,
  } as CSSProperties;
  const headerContent = (
    <>
      {theme.logoUrls.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
          {theme.logoUrls.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-14 sm:h-20 w-auto object-contain" />
          ))}
        </div>
      )}
      <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow">{event.title}</h1>
      {header.subtitle && <p className="mt-1 text-sm sm:text-base font-semibold opacity-90">{header.subtitle}</p>}
      {header.venue && <p className="text-sm opacity-80">{header.venue}</p>}
    </>
  );
  // Banner (image, GIF or muted looping video) plus the colour overlay; used by the header and the intro cover.
  const bannerPos = `${theme.bannerPosX}% ${theme.bannerPosY}%`; // admin-chosen focal point
  const bannerLayers = theme.bannerUrl ? (
    <>
      {isVideo(theme.bannerUrl) ? (
        <video src={theme.bannerUrl} autoPlay muted loop playsInline aria-hidden className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: bannerPos }} />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-cover" style={{ backgroundImage: `url("${theme.bannerUrl}")`, backgroundPosition: bannerPos }} />
      )}
      <div aria-hidden className="absolute inset-0" style={{ backgroundColor: theme.overlayColor, opacity: theme.overlayOpacity / 100 }} />
    </>
  ) : null;
  const tabClass = (on: boolean) =>
    `whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 ${on ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-slate-500 hover:text-slate-800"}`;

  return (
    <div style={style} className="flex-1 flex flex-col text-slate-800">
      <link rel="stylesheet" precedence="default" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(theme.font)}:wght@400;500;600;700;800&display=swap`} />
      <header
        className="relative"
        style={{ backgroundColor: theme.headerBg, color: theme.headerText, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {bannerLayers}
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 text-center">
          {intro && event.config.intro.enabled ? (
            <HeaderIntro seconds={event.config.intro.seconds} coverColor={theme.headerBg} cover={bannerLayers} logo={theme.logoUrls[0]}>{headerContent}</HeaderIntro>
          ) : (
            headerContent
          )}
        </div>
      </header>
      <nav className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-2 sm:px-6 flex items-center print:hidden">
          <Link href={`/e/${event.slug}`} className={tabClass(tab === "form")}>Registration Form</Link>
          <Link href={`/e/${event.slug}/status`} className={tabClass(tab === "status")}>Registration Status</Link>
          <Link href="/admin" className="ml-auto whitespace-nowrap px-3 py-3 text-sm text-slate-500 hover:text-slate-800">⚙ Login</Link>
        </div>
      </nav>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      <footer className="print:hidden border-t border-slate-200 px-4 py-3 text-center text-xs whitespace-pre-line" style={{ backgroundColor: theme.footerBg, color: theme.footerText }}>{footer}</footer>
    </div>
  );
}
