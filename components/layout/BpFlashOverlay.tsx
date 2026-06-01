"use client";

import { useEffect, useRef } from "react";
import { useSim } from "@/store/simulatorStore";

/** Full-screen red flash when a breakpoint fires. Motivated by a hardware event. */
export function BpFlashOverlay() {
  const bpFlash = useSim((s) => s.bpFlash);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bpFlash || !divRef.current) return;
    const el = divRef.current;
    el.classList.remove("bp-flash");
    // Force reflow.
    void el.offsetHeight;
    el.classList.add("bp-flash");
  }, [bpFlash]);

  return (
    <div
      ref={divRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 bg-signal-red/20"
      style={{ opacity: 0 }}
    />
  );
}
