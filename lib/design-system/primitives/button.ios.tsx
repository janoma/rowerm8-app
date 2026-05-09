/**
 * Button — iOS HIG flavor.
 *
 * Same API as the default web button (button.tsx); on iOS we tighten
 * the radius slightly (10 dp matches the iOS 17 system button look)
 * and use SF Pro Rounded weights via the system font selection that
 * iOS does for us automatically.
 *
 * The visual impl reuses the default file for now to avoid drift —
 * if the iOS treatment needs to diverge further, replace this body
 * with a fully custom impl.
 */

export { Button } from "./button";
