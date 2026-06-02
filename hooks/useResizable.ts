"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type Direction = "horizontal" | "vertical";

/**
 * Returns a CSS-pixel size and an onMouseDown handler for a drag handle.
 * `negate` reverses the delta sign — useful when the drag handle sits at the
 * top of a bottom panel (dragging UP should make it bigger).
 */
export function useResizable(
  key: string,
  defaultSize: number,
  min: number,
  max: number,
  direction: Direction = "horizontal",
  negate = false,
) {
  const [size, setSize] = useState(defaultSize);
  const sizeRef = useRef(defaultSize);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Restore persisted value on client mount.
  useEffect(() => {
    const stored = localStorage.getItem(`panel_${key}`);
    if (stored) {
      const n = parseInt(stored, 10);
      if (Number.isFinite(n) && n >= min && n <= max) {
        setSize(n);
        sizeRef.current = n;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === "horizontal" ? e.clientX : e.clientY;
      const startSize = sizeRef.current;

      function onMove(ev: MouseEvent) {
        const rawDelta =
          direction === "horizontal"
            ? ev.clientX - startPos
            : ev.clientY - startPos;
        const delta = negate ? -rawDelta : rawDelta;
        const next = Math.max(min, Math.min(max, startSize + delta));
        setSize(next);
        sizeRef.current = next;
      }

      function onUp() {
        localStorage.setItem(`panel_${key}`, String(sizeRef.current));
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }

      document.body.style.userSelect = "none";
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [key, min, max, direction, negate],
  );

  return { size, onDragStart };
}
