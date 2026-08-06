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
import { applyTheme, SITE_THEME_COLOR } from "./theme";

export default function useTheme(color) {
  useEffect(() => {
    applyTheme(color || SITE_THEME_COLOR);
    /* Reset to the site's own colours, not a user's — leaving a purple profile
     * should land you on a neutral page, not a purple one. */
    return () => applyTheme(SITE_THEME_COLOR);
  }, [color]);
}
