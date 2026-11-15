"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const MOVE_MS = 900; // header content: centre -> top
const LOGO_MS = 800; // loading logo: screen centre -> its place in the intro

// Opening animation, in two phases (FLIP: measure where things end up, animate from where they start):
//  A. Loading screen: the first logo centred on `loaderBg` (already in the server HTML, so it shows instantly).
//     When ready, the logo glides to its spot in the centred intro while the event name/date fade in.
//  B. After `seconds`, the header content glides up into the header and the cover fades to reveal the form.
export function HeaderIntro({ seconds, coverColor, cover, loaderBg, logo, children }: {
  seconds: number; coverColor: string; cover: ReactNode; loaderBg: string; logo?: string; children: ReactNode;
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

    // Phase A, once the logo images can be measured (never wait more than 1.5s).
    const ready = Promise.race([
      Promise.all([ll, target].map((img) => img?.decode().catch(() => null))),
      new Promise((res) => setTimeout(res, 1500)),
    ]);
    ready.then(() => requestAnimationFrame(() => {
      if (cancelled || moved) return;
      el.style.transition = "opacity 700ms ease 200ms";
      el.style.opacity = "1";
      const fade = ld.firstElementChild as HTMLElement; // the coloured layer behind the logo
      fade.style.transition = "opacity 600ms ease";
      fade.style.opacity = "0";
      if (ll && target) {
        const from = ll.getBoundingClientRect(), to = target.getBoundingClientRect();
        ll.style.transition = `transform ${LOGO_MS}ms cubic-bezier(.65,0,.35,1)`;
        ll.style.transformOrigin = "top left";
        ll.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
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
      {/* Loading screen: in the server HTML, so it's the first thing visitors see. */}
      <div ref={loader} aria-hidden className="intro-loader fixed inset-0 z-[80] flex cursor-pointer items-center justify-center">
        <div className="absolute inset-0" style={{ backgroundColor: loaderBg }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo && <img ref={loaderLogo} src={logo} alt="" className="relative h-28 w-auto object-contain sm:h-36" />}
      </div>
    </>
  );
}
