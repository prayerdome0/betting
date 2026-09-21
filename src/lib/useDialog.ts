"use client";
import { useEffect, useRef } from "react";
// Focus containment, scroll locking, and return-to-trigger behavior for dialogs.
export function useDialog() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const selector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
    const frame = requestAnimationFrame(() => {
      const target =
        root.querySelector<HTMLElement>("[autofocus]") ||
        root.querySelector<HTMLElement>(selector);
      target?.focus();
    });
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab" || !root) return;
      const elements = Array.from(
        root.querySelectorAll<HTMLElement>(selector),
      ).filter((el) => el.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        e.preventDefault();
        root.focus();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return ref;
}
