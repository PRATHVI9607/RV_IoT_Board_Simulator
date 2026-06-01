"use client";

import { useEffect } from "react";
import { useSim } from "@/store/simulatorStore";
import { KEYPAD_LABELS } from "@/lib/boardConfig";

/** Global debugger + board keyboard shortcuts (PRD §18.1). */
export function useKeyboard() {
  useEffect(() => {
    const flatKeys = new Map<string, [number, number]>();
    KEYPAD_LABELS.forEach((row, r) =>
      row.forEach((label, c) => flatKeys.set(label.toLowerCase(), [r, c])),
    );

    function isTyping(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    }

    function onKeyDown(e: KeyboardEvent) {
      const s = useSim.getState();
      if (isTyping(e.target)) return;

      switch (e.key) {
        case "F5":
          e.preventDefault();
          s.status === "running" ? s.pause() : s.run();
          return;
        case "F10":
          e.preventDefault();
          s.stepOver();
          return;
        case "F11":
          e.preventDefault();
          e.shiftKey ? s.stepOut() : s.stepInto();
          return;
        case "F9":
          e.preventDefault();
          s.toggleBreakpoint(s.snap.cpu.pc);
          return;
      }

      if (e.key === "F5" && e.ctrlKey) {
        e.preventDefault();
        s.stop();
        return;
      }
      if ((e.key === "r" || e.key === "R") && e.ctrlKey) {
        e.preventDefault();
        s.reset();
        return;
      }

      // Switches 1..8
      if (/^[1-8]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        s.toggleSwitch(parseInt(e.key, 10) - 1);
        return;
      }
      // Keypad 0-9 A-F (when not a switch digit conflict: 1-8 used above,
      // so keypad uses 0,9 and A-F via letters; digits 1-8 toggle switches).
      const k = e.key.toLowerCase();
      if (flatKeys.has(k) && !/^[1-8]$/.test(e.key)) {
        const [r, c] = flatKeys.get(k)!;
        s.pressKey(r, c, true);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const s = useSim.getState();
      const flat = new Map<string, [number, number]>();
      KEYPAD_LABELS.forEach((row, r) =>
        row.forEach((label, c) => flat.set(label.toLowerCase(), [r, c])),
      );
      const k = e.key.toLowerCase();
      if (flat.has(k) && !/^[1-8]$/.test(e.key)) {
        const [r, c] = flat.get(k)!;
        s.pressKey(r, c, false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
}
