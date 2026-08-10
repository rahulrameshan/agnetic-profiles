/*
 * useResizable.js
 * ---------------
 * Drag-to-resize for a panel that is anchored to a corner.
 *
 * The agent dock is pinned bottom-right, so its handles sit on the top and left
 * edges: dragging up or left grows it, away from the anchor. A bottom-right
 * grip — what CSS `resize` gives you — would push the panel off screen instead.
 *
 * The chosen size is remembered per panel, so reopening keeps the size you set.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function readStored(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && typeof stored.width === "number" && typeof stored.height === "number") {
      return stored;
    }
  } catch {
    /* Corrupt or absent — fall back to the default size. */
  }
  return fallback;
}

export default function useResizable({
  storageKey,
  defaultSize,
  minWidth = 300,
  minHeight = 260,
  marginX = 32,
  marginY = 110,
}) {
  const [size, setSize] = useState(() => readStored(storageKey, defaultSize));
  const [resizing, setResizing] = useState(false);
  const drag = useRef(null);

  /* Keep the panel on screen when the window shrinks under it. */
  useEffect(() => {
    const onResize = () =>
      setSize((current) => ({
        width: clamp(current.width, minWidth, window.innerWidth - marginX),
        height: clamp(current.height, minHeight, window.innerHeight - marginY),
      }));

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minWidth, minHeight, marginX, marginY]);

  /*
   * `axis` picks which dimensions a handle controls: the left edge changes
   * width, the top edge height, the corner both.
   */
  const startResize = useCallback(
    (axis) => (event) => {
      event.preventDefault();
      drag.current = {
        axis,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: size.width,
        startHeight: size.height,
      };
      setResizing(true);
    },
    [size.width, size.height]
  );

  useEffect(() => {
    if (!resizing) return undefined;

    const onMove = (event) => {
      const d = drag.current;
      if (!d) return;

      // Anchored bottom-right, so moving left/up must *increase* the size.
      const width =
        d.axis === "y"
          ? d.startWidth
          : clamp(
              d.startWidth + (d.startX - event.clientX),
              minWidth,
              window.innerWidth - marginX
            );

      const height =
        d.axis === "x"
          ? d.startHeight
          : clamp(
              d.startHeight + (d.startY - event.clientY),
              minHeight,
              window.innerHeight - marginY
            );

      setSize({ width, height });
    };

    const onUp = () => {
      setResizing(false);
      drag.current = null;
      setSize((final) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(final));
        } catch {
          /* Storage full or blocked; the size just won't persist. */
        }
        return final;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing, storageKey, minWidth, minHeight, marginX, marginY]);

  return { size, resizing, startResize };
}
