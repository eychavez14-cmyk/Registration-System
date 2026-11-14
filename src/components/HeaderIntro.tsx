"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const MOVE_MS = 900;

// Opening animation: the header content starts centred on a full-screen cover, then glides into its
// place at the top while the cover fades to reveal the form (FLIP: measure the final spot, start from the centre).
// The server HTML already has the cover up and content hidden, so the form never flashes first.
export function HeaderIntro({ seconds, coverColor, cover, children }: { seconds: number; coverColor: string; cover: ReactNode; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = content.current!, bd = backdrop.current!;
    const root = document.documentElement;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let moved = false;

    const finish = () => {
      timers.forEach(clearTimeout);
      el.style.cssText = "opacity:1;animation:none";
      bd.style.display = "none";
      root.style.overflow = "";
      removeEventListener("keydown", skip);
      bd.removeEventListener("click", skip);
    };
    const move = () => {
      if (moved) return;
      moved = true;
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

    // Stop the CSS safety timer: JavaScript is running, so it takes over.
    el.style.animation = bd.style.animation = "none";
    bd.style.cssText += ";display:block;opacity:1;transition:none"; // dev mode runs effects twice; undo the first cleanup
    scrollTo(0, 0);
    root.style.overflow = "hidden";
    const r = el.getBoundingClientRect();
    const scale = Math.min(1.5, (innerWidth * 0.9) / r.width, (innerHeight * 0.8) / r.height);
    el.style.transformOrigin = "center";
    el.style.transform = `translate(${innerWidth / 2 - (r.left + r.width / 2)}px, ${innerHeight / 2 - (r.top + r.height / 2)}px) scale(${scale})`;
    el.style.opacity = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = "opacity 700ms ease";
      el.style.opacity = "1";
    }));
    timers.push(setTimeout(move, Math.max(1, seconds) * 1000));
    addEventListener("keydown", skip);
    bd.addEventListener("click", skip);
    return finish;
  }, [seconds]);

  return (
    <>
      <div ref={backdrop} aria-hidden className="intro-backdrop fixed inset-0 z-[60] cursor-pointer" style={{ backgroundColor: coverColor }}>{cover}</div>
      <div ref={content} className="intro-content relative z-[70] mx-auto w-fit max-w-full">{children}</div>
    </>
  );
}
