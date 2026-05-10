#!/usr/bin/env bash
# Trace a raster reference image into the canonical assets/brand/icon.svg.
#
# Usage:
#   ./scripts/trace-icon.sh path/to/source.png
#
# Why this exists: the rowerm8 logo is delivered as a multi-color raster
# (and the chat/upload pipeline tends to JPEG-recompress whatever you hand
# it, smearing edges with ringing artifacts). potrace is a one-color
# tracer, so we have to (a) clean the JPEG noise, (b) reduce to a single
# silhouette, (c) trace, and (d) re-layer the accent color back in as an
# SVG circle behind the trace. This script is the deterministic version
# of that pipeline.
#
# Required tools (install with brew if missing):
#   brew install potrace imagemagick librsvg
#
# Tunable knobs are at the top. If the result still has artifacts, try
# raising BLUR_SIGMA, raising MORPH_CLOSE, or raising POTRACE_TURDSIZE.
# If the result has lost too much detail, lower them.

set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" ]]; then
  echo "usage: $0 <source-image.png>" >&2
  exit 1
fi
if [[ ! -r "$SRC" ]]; then
  echo "error: cannot read $SRC" >&2
  exit 1
fi

# --- tunables -----------------------------------------------------------
TEXT_MASK_Y=610          # blank out everything below this y (the wordmark)
ACCENT_HEX='#F36C1A'     # the orange middle-ring color in the source
ACCENT_FUZZ=35           # color tolerance for orange detection (percent)
BLUR_SIGMA=2             # gaussian blur radius BEFORE thresholding (px)
THRESHOLD_PCT=12         # brightness % above which a pixel is "subject"
MORPH_CLOSE=3            # close-disk radius: fills tiny gaps (px)
MORPH_OPEN=1.5           # open-disk radius: removes specks (px)
POTRACE_TURDSIZE=80      # ignore traced shapes <N px area
POTRACE_ALPHAMAX=1.2     # corner threshold (0=polygon … 1.3334=smooth)
POTRACE_OPTTOL=0.8       # curve simplification (higher = simpler)

# --- output paths -------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_SVG="$ROOT/assets/brand/icon.svg"
WORK="$ROOT/.tmp/trace"
mkdir -p "$WORK"

# --- 1. clean bitmap ----------------------------------------------------
# Mask the wordmark, swap orange for black so it merges with the background,
# then collapse to grayscale and blur to smooth JPEG ringing artifacts,
# threshold to bilevel, morphologically clean, and invert so subject = black.
magick "$SRC" \
  -fill black -draw "rectangle 0,${TEXT_MASK_Y} 1024,1024" \
  -fill black -fuzz "${ACCENT_FUZZ}%" -opaque "$ACCENT_HEX" \
  -alpha off \
  -colorspace gray \
  -blur "0x${BLUR_SIGMA}" \
  -threshold "${THRESHOLD_PCT}%" \
  -morphology Close "Disk:${MORPH_CLOSE}" \
  -morphology Open  "Disk:${MORPH_OPEN}" \
  -negate \
  "$WORK/clean.pbm"

# --- 2. trace -----------------------------------------------------------
potrace "$WORK/clean.pbm" \
  --svg \
  --turdsize     "$POTRACE_TURDSIZE" \
  --alphamax     "$POTRACE_ALPHAMAX" \
  --opttolerance "$POTRACE_OPTTOL" \
  --output       "$WORK/raw.svg"

# --- 3. find the orange-region centroid (so the accent disc is placed
#       exactly where the wheel "hole" is, regardless of source variants) -
ORANGE_BBOX=$(
  magick "$SRC" \
    -fill black -draw "rectangle 0,${TEXT_MASK_Y} 1024,1024" \
    -fuzz "${ACCENT_FUZZ}%" \
    -fill white -opaque "$ACCENT_HEX" \
    -fill black +opaque white \
    -alpha off \
    -define connected-components:verbose=true \
    -connected-components 4 \
    null: 2>/dev/null \
    | awk '/[(]255,255,255[)]/ && !/^  0:/ {print $2; exit}'
)
if [[ -z "$ORANGE_BBOX" ]]; then
  echo "error: could not locate $ACCENT_HEX region in source" >&2
  exit 1
fi

CX=$(echo "$ORANGE_BBOX" | awk -F'[x+]' '{printf "%.1f", $3 + $1/2}')
CY=$(echo "$ORANGE_BBOX" | awk -F'[x+]' '{printf "%.1f", $4 + $2/2}')
RADIUS=$(echo "$ORANGE_BBOX" | awk -F'[x+]' '{printf "%.0f", ($1 + 9) / 2}')

# --- 4. compute centering translation (target = (512, 512)) ------------
# In clean.pbm the subject is gray(0). Union all subject components' bboxes
# (the head can be detached from the body, hence multi-component union).
read -r SCX SCY <<<"$(
  magick "$WORK/clean.pbm" \
    -define connected-components:verbose=true \
    -connected-components 4 \
    null: 2>/dev/null \
    | awk '
        /[(]0[)]$/ && !/^  0:/ {
          n = split($2, a, /[x+]/)   # WxH+X+Y -> [W, H, X, Y]
          x1 = a[3] + 0; y1 = a[4] + 0
          x2 = x1 + a[1]; y2 = y1 + a[2]
          if (++hits == 1) { minX = x1; minY = y1; maxX = x2; maxY = y2 }
          else {
            if (x1 < minX) minX = x1
            if (y1 < minY) minY = y1
            if (x2 > maxX) maxX = x2
            if (y2 > maxY) maxY = y2
          }
        }
        END {
          printf "%.1f %.1f", (minX + maxX) / 2, (minY + maxY) / 2
        }
      '
)"
TX=$(awk -v c="$SCX" 'BEGIN{printf "%.1f", 512 - c}')
TY=$(awk -v c="$SCY" 'BEGIN{printf "%.1f", 512 - c}')

# --- 5. find head + inner hub from connected components ----------------
# Head: gray(0) component that's small (not the body) AND far from the
# wheel center (CX, CY). Hub: gray(0) component that's small AND right
# at the wheel center.
read -r HEAD_X HEAD_Y HEAD_R HUB_R <<<"$(
  magick "$WORK/clean.pbm" \
    -define connected-components:verbose=true \
    -connected-components 4 \
    null: 2>/dev/null \
    | awk -v cx="$CX" -v cy="$CY" -v orad="$RADIUS" '
        /[(]0[)]$/ && !/^  0:/ {
          n = split($2, a, /[x+]/)
          area = $4 + 0
          if (area > 30000) next        # skip body (the big component)
          split($3, c, ",")
          dx = c[1] - cx; dy = c[2] - cy
          d = sqrt(dx*dx + dy*dy)
          w = a[1] + 0; h = a[2] + 0
          r = (w + h) / 4
          if (d < orad * 0.7) {         # close to wheel center -> hub
            hubR = r + 2
          } else {                      # far from wheel center -> head
            headX = c[1]; headY = c[2]; headR = r + 2
          }
        }
        END {
          printf "%.1f %.1f %.0f %.0f", headX, headY, headR, hubR
        }
      '
)"

# Outer wheel radius: derive from the orange radius. The outer brand
# ring sits just past the orange edge (which is RADIUS) and stops short
# of the back support foot below the wheel. Empirically ~1.35× the
# orange radius works for this composition; OUTER_FACTOR is the knob.
OUTER_FACTOR=1.35
WHEEL_OUTER_R=$(awk -v r="$RADIUS" -v f="$OUTER_FACTOR" 'BEGIN{printf "%.0f", r * f}')

# --- 6. assemble final svg ---------------------------------------------
PATHS=$(sed -n '/stroke="none">$/,/^<\/g>$/{ /stroke="none">$/d; /^<\/g>$/d; p; }' "$WORK/raw.svg")

cat > "$OUT_SVG" <<HDR
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 1024 1024"
     role="img"
     aria-label="rowerm8 app icon">
  <title>rowerm8 app icon</title>
  <desc>
    Side-view of a seated rower on an indoor rowing machine. The body and
    machine are traced (via potrace) from a raster reference; the head and
    the three flywheel layers are perfect circles drawn on top so they read
    as clean geometric primitives at every size. Recolor by overriding the
    CSS variables --rm8-brand and --rm8-accent at the root. Defaults track
    packages/design-tokens/src/colors.ts (light theme accent) and
    packages/design-tokens/src/hr-zones.ts (Z3 yellow).
  </desc>

  <defs>
    <style>
      .brand  { fill: var(--rm8-brand,  #0A7EA4); }
      .accent { fill: var(--rm8-accent, #F5C518); }
    </style>
  </defs>

  <g id="rowerm8-icon" transform="translate(${TX} ${TY})">
    <g class="brand" transform="translate(0 1024) scale(0.1 -0.1)">
$PATHS
    </g>
    <circle class="brand"  cx="${CX}"     cy="${CY}"     r="${WHEEL_OUTER_R}" />
    <circle class="accent" cx="${CX}"     cy="${CY}"     r="${RADIUS}" />
    <circle class="brand"  cx="${CX}"     cy="${CY}"     r="${HUB_R}" />
    <circle class="brand"  cx="${HEAD_X}" cy="${HEAD_Y}" r="${HEAD_R}" />
  </g>
</svg>
HDR

echo "wrote $OUT_SVG"
echo "  silhouette center: ($SCX, $SCY) → translation ($TX, $TY)"
echo "  flywheel:          ($CX, $CY) outer=$WHEEL_OUTER_R accent=$RADIUS hub=$HUB_R"
echo "  head:              ($HEAD_X, $HEAD_Y) r=$HEAD_R"
echo "  paths:             $(grep -c '<path' "$OUT_SVG")"
echo "  size:              $(wc -c < "$OUT_SVG") bytes"
