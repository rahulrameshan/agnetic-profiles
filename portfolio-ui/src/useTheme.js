/*
 * useTheme.js
 * -----------
 * Applies a colour theme for as long as a component is mounted.
 *
 * The tokens are written onto :root, which is global, so the hook restores the
 * default on unmount. Without that, visiting a user's purple page and then the
 * landing page would leave the landing page purple.
 */

import { useEffect } from "react";
import { applyTheme, DEFAULT_THEME_COLOR } from "./theme";

export default function useTheme(color) {
  useEffect(() => {
    applyTheme(color || DEFAULT_THEME_COLOR);
    return () => applyTheme(DEFAULT_THEME_COLOR);
  }, [color]);
}
