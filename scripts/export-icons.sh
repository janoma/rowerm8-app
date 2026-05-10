#!/usr/bin/env bash
# Export OS-specific icon PNGs from the canonical assets/brand/icon.svg.
#
# Usage:
#   ./scripts/export-icons.sh                  # default colors + paths
#   pnpm run icons                             # via package.json
#
# Required tools (install with brew if missing):
#   brew install librsvg imagemagick
#
# What this writes (into assets/images/):
#   icon.png                          1024² iOS app icon, white bg, full bleed
#   android-icon-foreground.png       1024² adaptive foreground, content scaled
#                                     to the 66% safe zone, transparent bg
#   android-icon-background.png       1024² solid white
#   android-icon-monochrome.png       1024² black silhouette in 66% safe zone
#                                     for Android 13+ themed icons
#   favicon.png                       192²  web/PWA favicon, transparent bg
#   splash-icon.png                   1024² splash screen content, transparent
#                                     bg (the splash bg color is set in app.json)
#
# It also produces an iOS .icon bundle (Icon Composer / Liquid Glass format,
# Xcode 26+, supported by Expo SDK 54) at:
#   assets/AppIcon.icon/icon.json
#   assets/AppIcon.icon/Assets/Foreground.svg       (default / light)
#   assets/AppIcon.icon/Assets/Foreground-Dark.svg  (dark appearance)
#   assets/AppIcon.icon/Assets/Foreground-Mono.svg  (tinted appearance)
# Reference it from app.json as ios.icon: "./assets/AppIcon.icon".

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG="${1:-$ROOT/assets/brand/icon.svg}"
OUT="${OUT:-$ROOT/assets/images}"
ICON_BUNDLE="${ICON_BUNDLE:-$ROOT/assets/AppIcon.icon}"

# --- color tokens (kept in sync with packages/design-tokens/src) -------
BRAND_HEX='#0A7EA4'        # accent.light from colors.ts
BRAND_HEX_DARK='#3DB7E0'   # accent.dark from colors.ts
ACCENT_HEX='#F5C518'       # Z3 yellow from hr-zones.ts (theme-independent)
SURFACE_HEX='#FFFFFF'      # surface.light from colors.ts
SURFACE_HEX_DARK='#151718' # surface.dark from colors.ts
SAFE_ZONE_PCT=66           # Android adaptive icon "always-visible" inner area

# Layer scale for the iOS .icon bundle. The source SVG centers the rower
# inside its 1024² viewBox with intrinsic padding, so at scale 1.0 the
# art only fills ~63% of the icon canvas. Apple's typical app icon
# fills ~75–85%. Binding constraint is the watchOS round mask
# (inscribed circle of the canvas) — wheel/head touch the mask edge
# around scale 1.55, so anything ≤ 1.50 is safe; 1.30 keeps a generous
# margin (~80 px). Tweak in Icon Composer's Composition → Position
# panel after opening the bundle, or change this and re-run.
ICON_LAYER_SCALE='1.30'

# --- guards -------------------------------------------------------------
need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing: $1 (try: brew install $2)" >&2; exit 1;
  }
}
need rsvg-convert librsvg
need magick imagemagick

[[ -r "$SVG" ]] || { echo "cannot read $SVG" >&2; exit 1; }

mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# --- helpers ------------------------------------------------------------
# Resolve CSS variables in icon.svg into hex colors. rsvg-convert and
# most browsers handle var() fallbacks fine, but we substitute eagerly
# so downstream consumers don't have to. Pattern is tolerant of
# whitespace/fallback so it can't silently drift.
resolve_svg() {
  local brand=$1 accent=$2 dest=$3
  sed \
    -e "s|var(--rm8-brand,[^)]*)|$brand|g" \
    -e "s|var(--rm8-accent,[^)]*)|$accent|g" \
    "$SVG" > "$dest"
}

# Same as resolve_svg, but also flattens CSS classes into inline fill
# attributes and strips the <defs><style>…</style></defs> block. Apple's
# Icon Composer SVG parser doesn't evaluate <style>/class fills (real
# Icon Composer outputs use inline attributes everywhere, see
# jasonlong/octodot's checked-in AppIcon.icon), so we feed it that shape.
flatten_svg() {
  local brand=$1 accent=$2 dest=$3
  sed \
    -e "s|var(--rm8-brand,[^)]*)|$brand|g" \
    -e "s|var(--rm8-accent,[^)]*)|$accent|g" \
    -e "s|class=\"brand\"|fill=\"$brand\"|g" \
    -e "s|class=\"accent\"|fill=\"$accent\"|g" \
    -e 's| role="img"||g' \
    -e 's| aria-label="[^"]*"||g' \
    "$SVG" \
  | awk '
      /<defs>/  { in_defs  = 1 }
      /<title>/ { in_title = 1 }
      /<desc/   { in_desc  = 1 }
      !in_defs && !in_title && !in_desc { print }
      /<\/defs>/  { in_defs  = 0 }
      /<\/title>/ { in_title = 0 }
      /<\/desc>/  { in_desc  = 0 }
    ' \
  | sed -e 's|^<svg |<svg width="1024" height="1024" |' \
  > "$dest"
}

# Render the SVG at a given pixel size, trim transparent margins, then
# fit the trimmed bitmap into a square canvas at the given fraction (so
# the visible content lands in Android's safe zone).
render_with_safezone() {
  local svg=$1 canvas_px=$2 safe_pct=$3 dest=$4
  local inner=$(( canvas_px * safe_pct / 100 ))
  rsvg-convert -w 2048 -h 2048 -b transparent "$svg" \
    | magick - -trim +repage \
        -resize "${inner}x${inner}" \
        -background none -gravity center -extent "${canvas_px}x${canvas_px}" \
        "$dest"
}

# --- color variants -----------------------------------------------------
resolve_svg "$BRAND_HEX"  "$ACCENT_HEX" "$WORK/color.svg"
resolve_svg '#000000'     '#000000'     "$WORK/mono.svg"

# --- 1. iOS app icon ----------------------------------------------------
# 1024², white background, no transparency. We render full bleed (the
# SVG's own ~10% padding gives plenty of breathing room inside iOS's
# rounded-square mask).
rsvg-convert -w 1024 -h 1024 -b transparent "$WORK/color.svg" \
  | magick - -background "#FFFFFF" -alpha remove -alpha off \
      "$OUT/icon.png"

# --- 2. Android adaptive foreground ------------------------------------
# 1024², transparent. Content scaled into the 66% safe zone so it can't
# be clipped by any launcher mask shape.
render_with_safezone "$WORK/color.svg" 1024 "$SAFE_ZONE_PCT" \
  "$OUT/android-icon-foreground.png"

# --- 3. Android adaptive background ------------------------------------
# Solid white. (Expo also reads adaptiveIcon.backgroundColor from
# app.json — this PNG is just a fallback.)
magick -size 1024x1024 canvas:"#FFFFFF" "$OUT/android-icon-background.png"

# --- 4. Android monochrome (themed icons) ------------------------------
# Same shape as foreground but rendered with all colors collapsed to
# black. Android 13+ tints this with the user's wallpaper color.
render_with_safezone "$WORK/mono.svg" 1024 "$SAFE_ZONE_PCT" \
  "$OUT/android-icon-monochrome.png"

# --- 5. Favicon ---------------------------------------------------------
# 192², transparent — small enough that the safe-zone padding would just
# wash it out. Trim and render edge-to-edge.
rsvg-convert -w 1024 -h 1024 -b transparent "$WORK/color.svg" \
  | magick - -trim +repage -resize 192x192 \
      -background none -gravity center -extent 192x192 \
      "$OUT/favicon.png"

# --- 6. Splash icon -----------------------------------------------------
# Used by expo-splash-screen with `resizeMode: contain`. Match the
# adaptive-foreground sizing so the splash and the launcher icon render
# at the same visual size when the OS hands off.
render_with_safezone "$WORK/color.svg" 1024 "$SAFE_ZONE_PCT" \
  "$OUT/splash-icon.png"

# --- 7. iOS .icon bundle (Icon Composer / Liquid Glass) ----------------
# Bundle layout per the Icon Composer file format (Xcode 26+, Icon
# Composer 1.4):
#   AppIcon.icon/
#     icon.json    # manifest — pretty-printed JSON, kebab-case keys
#     Assets/      # layer art referenced by `image-name` (+ extras)
#       Foreground.svg          (the layer that icon.json references)
#       Foreground-Dark.svg     (alt — wire into Icon Composer manually
#                                if you want a different dark-mode art)
#       Foreground-Mono.svg     (alt — for tinted/themed appearance)
#
# The manifest is intentionally minimal so it round-trips through Icon
# Composer 1.4 cleanly. Schema reverse-engineered from a real Icon
# Composer output (jasonlong/octodot@11b455b/AppIcon.icon/icon.json).
# Per-appearance background color is varied via `fill-specializations`.
# Per-appearance foreground art (dark/mono) cannot be expressed reliably
# in 1.4 without invoking GUI-only fields — open the bundle in Icon
# Composer and drag in Foreground-Dark.svg / Foreground-Mono.svg if you
# want that, or just let the system derive Dark/Tinted from the single
# foreground (which it does fine).
ASSETS_DIR="$ICON_BUNDLE/Assets"
mkdir -p "$ASSETS_DIR"

# Light: brand teal + yellow accent — this is the layer Icon Composer
# loads. The dark and mono variants ship alongside but are not wired in
# by default (see note above). All three are flat-fill SVGs (no CSS
# classes / no <defs>) so Icon Composer's parser accepts them.
flatten_svg "$BRAND_HEX"      "$ACCENT_HEX" "$ASSETS_DIR/Foreground.svg"
flatten_svg "$BRAND_HEX_DARK" "$ACCENT_HEX" "$ASSETS_DIR/Foreground-Dark.svg"
flatten_svg "#000000"         "#000000"     "$ASSETS_DIR/Foreground-Mono.svg"

# Convert "#RRGGBB" -> "srgb:r,g,b,1.00000" matching the precision Icon
# Composer itself emits (5 fractional digits).
hex_to_srgb() {
  local hex=${1#\#}
  local r=$(printf "%d" "0x${hex:0:2}")
  local g=$(printf "%d" "0x${hex:2:2}")
  local b=$(printf "%d" "0x${hex:4:2}")
  awk -v r="$r" -v g="$g" -v b="$b" \
    'BEGIN{ printf "srgb:%.5f,%.5f,%.5f,1.00000", r/255, g/255, b/255 }'
}
LIGHT_FILL=$(hex_to_srgb "$SURFACE_HEX")
DARK_FILL=$(hex_to_srgb "$SURFACE_HEX_DARK")

cat > "$ICON_BUNDLE/icon.json" <<EOF
{
  "fill" : {
    "solid" : "$LIGHT_FILL"
  },
  "fill-specializations" : [
    {
      "appearance" : "dark",
      "value" : {
        "solid" : "$DARK_FILL"
      }
    }
  ],
  "groups" : [
    {
      "name" : "Rower",
      "layers" : [
        {
          "image-name" : "Foreground.svg",
          "name" : "Rower",
          "position" : {
            "scale" : $ICON_LAYER_SCALE,
            "translation-in-points" : [
              0,
              0
            ]
          }
        }
      ]
    }
  ],
  "supported-platforms" : {
    "circles" : [
      "watchOS"
    ],
    "squares" : "shared"
  }
}
EOF

# --- summary ------------------------------------------------------------
echo "wrote PNGs:"
for f in icon android-icon-foreground android-icon-background \
         android-icon-monochrome favicon splash-icon; do
  size=$(magick identify -format "%wx%h" "$OUT/$f.png")
  bytes=$(wc -c < "$OUT/$f.png" | tr -d ' ')
  printf "  %-32s %-9s %8s bytes\n" "$f.png" "$size" "$bytes"
done

echo "wrote .icon bundle:"
for f in "icon.json" "Assets/Foreground.svg" "Assets/Foreground-Dark.svg" \
         "Assets/Foreground-Mono.svg"; do
  bytes=$(wc -c < "$ICON_BUNDLE/$f" | tr -d ' ')
  printf "  AppIcon.icon/%-30s %8s bytes\n" "$f" "$bytes"
done
