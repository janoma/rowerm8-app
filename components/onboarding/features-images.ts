/**
 * Curated Unsplash photo references for the first-install features carousel.
 *
 * Each entry is a permanent `images.unsplash.com/photo-<id>` URL plus the
 * photographer attribution required by the Unsplash License. The URLs accept
 * the standard query params (`w`, `auto=format`, `fit=crop`, `q`) so we
 * request right-sized, well-compressed assets per device.
 *
 * If we ever need to swap a slide, replace just the `photoId` and `credit`
 * fields here — the component does the rendering.
 */

export type FeaturesSlideKey = "live" | "track" | "review";

export type FeaturesSlideImage = {
  /** i18n key under `onboarding.features.slides.<key>`. */
  key: FeaturesSlideKey;
  /** Unsplash photo ID (the `photo-<hash>` segment of the CDN URL). */
  photoId: string;
  /** Original Unsplash photo page (for attribution traceability). */
  sourceUrl: string;
  credit: {
    photographer: string;
    handle: string;
  };
};

const UNSPLASH_CDN = "https://images.unsplash.com";

export const FEATURES_SLIDES: readonly FeaturesSlideImage[] = [
  {
    key: "live",
    photoId: "photo-1738524108393-4a244a5baa99",
    sourceUrl:
      "https://unsplash.com/photos/a-man-riding-a-machine-in-a-gym-HL2w_WqlKdE",
    credit: {
      photographer: "Sergio Kian",
      handle: "sergiokian",
    },
  },
  {
    key: "track",
    photoId: "photo-1491911923017-19f90d8d7f83",
    sourceUrl:
      "https://unsplash.com/photos/five-men-riding-row-boat-Ev1XqeVL2wI",
    credit: {
      photographer: "Josh Calabrese",
      handle: "joshcala",
    },
  },
  {
    key: "review",
    photoId: "photo-1767424412548-1a1ac7f4b9bc",
    sourceUrl:
      "https://unsplash.com/photos/trading-charts-displayed-on-multiple-screens-and-tablet-vKNRKjSNbTo",
    credit: {
      photographer: "Jakub Żerdzicki",
      handle: "jakubzerdzicki",
    },
  },
];

/** Slides are rendered inside a 2:3 portrait box (see `imageWrap` in
 * `features-carousel.tsx`); we request the CDN crop at the same ratio so
 * the file we download already matches what we display. */
const SLIDE_ASPECT_WIDTH = 2;
const SLIDE_ASPECT_HEIGHT = 3;

/**
 * Build a CDN URL for a slide image at the requested rendered width. The
 * `w` parameter is the *display* width in pixels; we ask Unsplash to encode
 * a 2x asset so the image stays crisp on retina displays without forcing a
 * manual 2x/3x source set, and pass a matching `h` so the server crops to
 * our 2:3 portrait container instead of returning the photo's native aspect.
 */
export function buildSlideImageUrl(
  slide: FeaturesSlideImage,
  displayWidth: number,
): string {
  const sourceWidth = Math.min(
    2160,
    Math.max(720, Math.round(displayWidth * 2)),
  );
  const sourceHeight = Math.round(
    (sourceWidth * SLIDE_ASPECT_HEIGHT) / SLIDE_ASPECT_WIDTH,
  );
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    q: "70",
    w: String(sourceWidth),
    h: String(sourceHeight),
  });
  return `${UNSPLASH_CDN}/${slide.photoId}?${params.toString()}`;
}
