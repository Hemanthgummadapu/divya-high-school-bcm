/** Sports page content — activities offered and gallery paths under /images/ */

export const SPORTS_OFFERED = [
  "Kabaddi",
  "Kho-Kho",
  "Cricket",
  "Football",
  "Athletics",
  "Yoga",
  "March Past",
  "PT Drill",
] as const;

/** Hero + sports moments — assets in public/images/ */
export const SPORTS_PT_DRILL_IMAGE = "/images/sports-pt-drill.png";

export const SPORTS_MOMENTS = [
  {
    src: SPORTS_PT_DRILL_IMAGE,
    alt: "Students during daily PT drill in the school courtyard",
  },
] as const;
