import {
  SCHOOL_BUILDING_IMAGE,
  SLIDESHOW2_IMAGE,
  STUDENTS_UNIFORM_IMAGE,
} from "@/lib/public-assets";

export type GalleryCategory =
  | "annual-day"
  | "sports"
  | "campus"
  | "academics"
  | "cultural-events";

export type GalleryFilter = "all" | GalleryCategory;

export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  category: GalleryCategory;
};

/** Performance-focused shots tagged as Cultural Events; remainder of annual-day folder → Annual Day */
const CULTURAL_EVENTS_NUMBERS = new Set([
  2, 5, 8, 10, 11, 13, 15, 17, 19, 23, 39, 45, 58, 72, 79, 94, 101,
]);

const ANNUAL_DAY_CAPTIONS = [
  "Annual Day celebration",
  "Students performing on stage",
  "Cultural dance performance",
  "Stage show highlights",
  "Group performance",
  "Student talent showcase",
];

const CULTURAL_CAPTIONS = [
  "Cultural dance by students",
  "Folk dance performance",
  "Cultural program highlights",
  "Traditional dance at school",
  "Cultural fest moment",
];

function culturalImagePath(n: number) {
  return `/images/cultural/divya-annual-day-${n}.jpg`;
}

function buildCulturalFolderImages(): GalleryImage[] {
  const images: GalleryImage[] = [];
  for (let n = 1; n <= 108; n++) {
    const isCulturalEvent = CULTURAL_EVENTS_NUMBERS.has(n);
    const category: GalleryCategory = isCulturalEvent ? "cultural-events" : "annual-day";
    const captions = isCulturalEvent ? CULTURAL_CAPTIONS : ANNUAL_DAY_CAPTIONS;
    images.push({
      id: `cultural-${n}`,
      src: culturalImagePath(n),
      alt: isCulturalEvent
        ? "Cultural program at Divya High School"
        : "Annual Day at Divya High School",
      caption: captions[n % captions.length],
      category,
    });
  }
  return images;
}

const STATIC_GALLERY_IMAGES: GalleryImage[] = [
  {
    id: "campus-building",
    src: SCHOOL_BUILDING_IMAGE,
    alt: "Divya High School campus",
    caption: "School building & courtyard",
    category: "campus",
  },
  {
    id: "campus-students",
    src: STUDENTS_UNIFORM_IMAGE,
    alt: "Students in school uniform",
    caption: "Campus & student life",
    category: "campus",
  },
  {
    id: "sports-pt-drill",
    src: "/images/sports-pt-drill.png",
    alt: "Students during PT drill",
    caption: "PT drill & physical education",
    category: "sports",
  },
  {
    id: "academics-toppers",
    src: "/images/toppers-2026.jpg",
    alt: "Class X toppers 2026",
    caption: "Academic achievement — Class X toppers",
    category: "academics",
  },
];

/** Full gallery catalog (static + cultural folder) */
export const GALLERY_IMAGES: GalleryImage[] = [
  ...STATIC_GALLERY_IMAGES,
  ...buildCulturalFolderImages(),
];

export const GALLERY_FILTERS: { value: GalleryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "annual-day", label: "Annual Day" },
  { value: "sports", label: "Sports" },
  { value: "campus", label: "Campus" },
  { value: "academics", label: "Academics" },
  { value: "cultural-events", label: "Cultural Events" },
];

/** Max consecutive photos from the same category in the default “All” view */
const MAX_CONSECUTIVE_SAME_CATEGORY = 3;

/** Round-robin interleave so “All” feels mixed, not one long Annual Day block */
export function interleaveGalleryImages(
  images: GalleryImage[],
  maxConsecutive = MAX_CONSECUTIVE_SAME_CATEGORY
): GalleryImage[] {
  const buckets = new Map<GalleryCategory, GalleryImage[]>();
  for (const img of images) {
    const list = buckets.get(img.category) ?? [];
    list.push(img);
    buckets.set(img.category, list);
  }

  const categories = Array.from(buckets.keys());
  const pointers: Record<string, number> = Object.fromEntries(categories.map((c) => [c, 0]));
  const result: GalleryImage[] = [];
  let streakCategory: GalleryCategory | null = null;
  let streak = 0;
  let rotateFrom = 0;

  while (result.length < images.length) {
    let placed = false;

    for (let attempt = 0; attempt < categories.length; attempt++) {
      const cat = categories[(rotateFrom + attempt) % categories.length];
      const ptr = pointers[cat] ?? 0;
      const bucket = buckets.get(cat)!;
      if (ptr >= bucket.length) continue;
      if (cat === streakCategory && streak >= maxConsecutive) continue;

      result.push(bucket[ptr]);
      pointers[cat] = ptr + 1;
      rotateFrom = (rotateFrom + attempt + 1) % categories.length;

      if (cat === streakCategory) streak++;
      else {
        streakCategory = cat;
        streak = 1;
      }
      placed = true;
      break;
    }

    if (!placed) {
      const cat = categories.find((c) => (pointers[c] ?? 0) < buckets.get(c)!.length);
      if (!cat) break;
      const ptr = pointers[cat] ?? 0;
      result.push(buckets.get(cat)![ptr]);
      pointers[cat] = ptr + 1;
      streakCategory = cat;
      streak = 1;
      rotateFrom = (categories.indexOf(cat) + 1) % categories.length;
    }
  }

  return result;
}

export function getGalleryDisplayList(filter: GalleryFilter): GalleryImage[] {
  if (filter === "all") {
    return interleaveGalleryImages(GALLERY_IMAGES);
  }
  return GALLERY_IMAGES.filter((img) => img.category === filter);
}

/** Six diverse previews for the homepage — no textbook covers or duplicate uniform shots */
export const HOME_GALLERY_PREVIEW: Pick<GalleryImage, "src" | "alt">[] = [
  { src: SCHOOL_BUILDING_IMAGE, alt: "Divya High School campus" },
  { src: STUDENTS_UNIFORM_IMAGE, alt: "Students in school uniform" },
  { src: SLIDESHOW2_IMAGE, alt: "School assembly and events" },
  { src: "/images/toppers-2026.jpg", alt: "Class X toppers 2026" },
  { src: culturalImagePath(7), alt: "Annual Day dance performance" },
  { src: culturalImagePath(39), alt: "Folk dance by students" },
];
