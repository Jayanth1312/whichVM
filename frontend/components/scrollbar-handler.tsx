"use client";

import { useEffect } from "react";

export function ScrollbarHandler() {
  useEffect(() => {
    let pageScrollTimer: NodeJS.Timeout | null = null;
    const elementTimers = new Map<HTMLElement, NodeJS.Timeout>();

    const handleScroll = (event: Event) => {
      const target = event.target;

      // Check if it's the main page scrolling (document or html/body)
      const isPageScroll =
        target instanceof Document ||
        target === document.documentElement ||
        target === document.body;

      if (isPageScroll) {
        // Show page scrollbar on <html>
        document.documentElement.classList.add("scrolling");

        if (pageScrollTimer) clearTimeout(pageScrollTimer);
        pageScrollTimer = setTimeout(() => {
          document.documentElement.classList.remove("scrolling");
          pageScrollTimer = null;
        }, 2000);
      } else if (target instanceof HTMLElement) {
        // Show scrollbar on the specific element being scrolled
        target.classList.add("scrolling");

        const existing = elementTimers.get(target);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          target.classList.remove("scrolling");
          elementTimers.delete(target);
        }, 2000);

        elementTimers.set(target, timer);
      }
    };

    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      if (pageScrollTimer) clearTimeout(pageScrollTimer);
      elementTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return null;
}
