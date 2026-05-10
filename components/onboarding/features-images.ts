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
    photoId: "photo-1769614469134-139f45a469f3",
    sourceUrl:
      "https://unsplash.com/photos/man-rowing-on-a-machine-in-a-gym-8yvUhE3hiiM",
    credit: {
      photographer: "Darío Cano Jiménez",
      handle: "zafiro2222",
    },
  },
  {
    key: "track",
    photoId: "photo-1696660760822-833afde62f94",
    sourceUrl:
      "https://unsplash.com/photos/a-close-up-of-a-person-wearing-a-smart-watch-eX2wDKGHN10",
    credit: {
      photographer: "Daniel Romero",
      handle: "rmrdnl",
    },
  },
  {
    key: "review",
    photoId: "photo-1531140035644-4ce1e6e1b85f",
    sourceUrl:
      "https://unsplash.com/photos/man-looking-at-activity-tracker-jFzOZTf-9Yk",
    credit: {
      photographer: "FitNish Media",
      handle: "fitnish",
    },
  },
];

/**
 * Build a CDN URL for a slide image at the requested rendered width. The
 * `w` parameter is the *display* width in pixels; we ask Unsplash to encode
 * a 2x asset so the image stays crisp on retina displays without forcing a
 * manual 2x/3x source set.
 */
export function buildSlideImageUrl(
  slide: FeaturesSlideImage,
  displayWidth: number,
): string {
  const sourceWidth = Math.min(
    2160,
    Math.max(720, Math.round(displayWidth * 2)),
  );
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    q: "70",
    w: String(sourceWidth),
  });
  return `${UNSPLASH_CDN}/${slide.photoId}?${params.toString()}`;
}
