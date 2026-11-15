"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { skipOptimize } from "@/lib/media";

const MOVE_MS = 900; // header content: centre -> top
const LOADER_MIN_MS = 1000; // loading screen stays at least this long (from page open)
// Mechanical logo motion: straight constant-speed slide, dead stop, short lock pause, then a firm snap to size.
const SLIDE_MS = 560, LOCK_MS = 100, SNAP_MS = 340;
const LOGO_MS = SLIDE_MS + LOCK_MS + SNAP_MS; // 1000

// Opening animation, in two phases (FLIP: measure where things end up, animate from where they start):
//  A. Loading screen: the first logo centred over the banner (already in the server HTML, so it shows instantly).
//     After 1s (and once ready) the logo slides, locks and snaps into its spot in the centred intro.
//  B. After `seconds`, the header content glides up into the header and the cover fades to reveal the form.
export function HeaderIntro({ seconds, coverColor, cover, logo, children }: {
  seconds: number; coverColor: string; cover: ReactNode; logo?: string; children: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const loaderLogo = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const el = content.current!, bd = backdrop.current!, ld = loader.current!, ll = loaderLogo.current;
    const root = document.documentElement;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const target = el.querySelector("img"); // the same logo inside the intro content
    let moved = false, cancelled = false;

    const hideLoader = () => {
      ld.style.display = "none";
      if (target) target.style.visibility = "";
    };
    const finish = () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      el.style.cssText = "opacity:1;animation:none";
      bd.style.display = "none";
      hideLoader();
      root.style.overflow = "";
      removeEventListener("keydown", skip);
      bd.removeEventListener("click", skip);
      ld.removeEventListener("click", skip);
    };
    const move = () => {
      if (moved) return;
      moved = true;
      hideLoader();
      el.style.transition = `transform ${MOVE_MS}ms cubic-bezier(.65,0,.35,1), opacity 300ms`;
      el.style.opacity = "1";
      el.style.transform = "none";
      bd.style.transition = `opacity 600ms ease ${MOVE_MS - 500}ms`;
      bd.style.opacity = "0";
      timers.push(setTimeout(finish, MOVE_MS + 150));
    };
    const skip = () => move();

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    // Stop the CSS safety timers: JavaScript is running, so it takes over.
    el.style.animation = bd.style.animation = ld.style.animation = "none";
    bd.style.cssText += ";display:block;opacity:1;transition:none"; // dev mode runs effects twice; undo the first cleanup
    ld.style.display = "flex";
    scrollTo(0, 0);
    root.style.overflow = "hidden";

    // Centre the header content (logos, title, date) on the cover, hidden for now.
    const r = el.getBoundingClientRect();
    const scale = Math.min(1.5, (innerWidth * 0.9) / r.width, (innerHeight * 0.8) / r.height);
    el.style.transformOrigin = "center";
    el.style.transform = `translate(${innerWidth / 2 - (r.left + r.width / 2)}px, ${innerHeight / 2 - (r.top + r.height / 2)}px) scale(${scale})`;
    el.style.opacity = "0";
    if (target && ll) target.style.visibility = "hidden"; // the flying logo stands in for it until it lands

    // Phase A starts once the loading screen has shown for LOADER_MIN_MS (performance.now() counts from page open)
    // and the logo images can be measured (but never waits more than 1.5s longer for slow images).
    const minShown = new Promise((res) => setTimeout(res, Math.max(0, LOADER_MIN_MS - performance.now())));
    const imagesReady = Promise.race([
      Promise.all([ll, target].map((img) => img?.decode().catch(() => null))),
      new Promise((res) => setTimeout(res, LOADER_MIN_MS)),
    ]);
    Promise.all([minShown, imagesReady]).then(() => requestAnimationFrame(() => {
      if (cancelled || moved) return;
      // Event name/date appear only as the logo snaps into place (not underneath the big flying logo).
      el.style.transition = `opacity 350ms ease ${LOGO_MS - 150}ms`;
      el.style.opacity = "1";
      if (ll && target) {
        // Centre-to-centre slide, then scale about the centre: two separate, machine-like motions.
        const from = ll.getBoundingClientRect(), to = target.getBoundingClientRect();
        const slide = `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px)`;
        ll.style.transformOrigin = "center";
        ll.style.transition = `transform ${SLIDE_MS}ms linear`;
        ll.style.transform = slide;
        timers.push(setTimeout(() => {
          ll.style.transition = `transform ${SNAP_MS}ms cubic-bezier(.7,0,1,1)`; // accelerate into a hard stop
          ll.style.transform = `${slide} scale(${to.width / from.width})`;
        }, SLIDE_MS + LOCK_MS));
      }
      timers.push(setTimeout(hideLoader, LOGO_MS + 50));
      timers.push(setTimeout(move, LOGO_MS + Math.max(1, seconds) * 1000)); // Phase B
    }));

    addEventListener("keydown", skip);
    bd.addEventListener("click", skip);
    ld.addEventListener("click", skip);
    return finish;
  }, [seconds]);

  return (
    <>
      <div ref={backdrop} aria-hidden className="intro-backdrop fixed inset-0 z-[60] cursor-pointer" style={{ backgroundColor: coverColor }}>{cover}</div>
      <div ref={content} className="intro-content relative z-[70] mx-auto w-fit max-w-full">{children}</div>
      {/* Loading screen: just the logo, over the banner cover beneath (both in the server HTML, so they show instantly). */}
      <div ref={loader} aria-hidden className="intro-loader fixed inset-0 z-[80] flex cursor-pointer items-center justify-center">
        {logo && <Image ref={loaderLogo} src={logo} alt="" width={432} height={432} preload sizes="(min-width: 640px) 432px, 336px" unoptimized={skipOptimize(logo)} className="relative h-[336px] max-h-[60vh] w-auto max-w-[90vw] object-contain sm:h-[432px]" />}
      </div>
    </>
  );
}
