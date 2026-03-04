# 📁 Divya High School BCM - Project Structure

```
divya-high-school-bcm/
│
├── 📄 Configuration Files
│   ├── package.json              # Dependencies & scripts
│   ├── tsconfig.json             # TypeScript config
│   ├── tailwind.config.ts        # Tailwind CSS config
│   ├── next.config.js            # Next.js config
│   ├── postcss.config.mjs        # PostCSS config
│   ├── .eslintrc.json            # ESLint config
│   └── .gitignore                # Git ignore rules
│
├── 📁 public/                     # Static Assets (served at root)
│   ├── logo.png                  # School logo
│   ├── principal.png             # Principal's image
│   ├── slideshow-assembly.png    # Assembly image
│   ├── slideshow-school.png      # School building
│   └── slideshow-sports.png       # Sports image
│
└── 📁 src/                        # Source Code
    │
    ├── 📁 app/                    # Next.js App Router (File-based Routing)
    │   │
    │   ├── layout.tsx             # 🎯 Root Layout (Navbar + Footer wrapper)
    │   ├── page.tsx               # 🏠 Home Page (/)
    │   ├── loading.tsx            # ⏳ Loading UI component
    │   │
    │   ├── 📁 about/              # /about route
    │   │   ├── page.tsx           # Main About page
    │   │   ├── principals-note/
    │   │   │   └── page.tsx        # /about/principals-note
    │   │   ├── mission-vision/
    │   │   │   └── page.tsx       # /about/mission-vision
    │   │   └── staff-details/
    │   │       └── page.tsx       # /about/staff-details
    │   │
    │   ├── 📁 admissions/         # /admissions route
    │   │   ├── page.tsx           # Main Admissions page
    │   │   ├── admission-process/
    │   │   │   └── page.tsx       # /admissions/admission-process
    │   │   ├── fee-structure/
    │   │   │   └── page.tsx       # /admissions/fee-structure
    │   │   └── online-form/
    │   │       └── page.tsx       # /admissions/online-form
    │   │
    │   ├── 📁 academics/           # /academics route
    │   │   ├── page.tsx           # Main Academics page
    │   │   ├── curriculum/
    │   │   │   └── page.tsx       # /academics/curriculum
    │   │   ├── faculty/
    │   │   │   └── page.tsx       # /academics/faculty
    │   │   ├── question-papers/
    │   │   │   └── page.tsx       # /academics/question-papers
    │   │   └── results/
    │   │       └── page.tsx       # /academics/results
    │   │
    │   ├── 📁 contact/             # /contact route
    │   │   └── page.tsx           # Contact page
    │   │
    │   ├── 📁 gallery/             # /gallery route
    │   │   └── page.tsx           # Gallery page
    │   │
    │   └── 📁 sports/              # /sports route
    │       └── page.tsx           # Sports page
    │
    ├── 📁 components/              # Reusable React Components
    │   ├── Navbar.tsx             # 🧭 Navigation with dropdowns
    │   ├── Footer.tsx             # 📄 Footer with links
    │   ├── Hero.tsx               # 🎨 Hero section
    │   ├── HeroSlideshow.tsx      # 🖼️ Hero image slideshow
    │   ├── AdmissionBanner.tsx    # 📢 Admission banner
    │   └── SportsSlideshow.tsx    # ⚽ Sports slideshow
    │
    ├── 📁 styles/                  # Global Styles
    │   └── globals.css            # Tailwind imports + custom styles
    │
    └── 📁 lib/                     # Utility Functions (reserved)
        └── .gitkeep
```

## 🗺️ Route Mapping

| URL Path | File Location |
|----------|---------------|
| `/` | `src/app/page.tsx` |
| `/about` | `src/app/about/page.tsx` |
| `/about/principals-note` | `src/app/about/principals-note/page.tsx` |
| `/about/mission-vision` | `src/app/about/mission-vision/page.tsx` |
| `/about/staff-details` | `src/app/about/staff-details/page.tsx` |
| `/admissions` | `src/app/admissions/page.tsx` |
| `/admissions/admission-process` | `src/app/admissions/admission-process/page.tsx` |
| `/admissions/fee-structure` | `src/app/admissions/fee-structure/page.tsx` |
| `/admissions/online-form` | `src/app/admissions/online-form/page.tsx` |
| `/academics` | `src/app/academics/page.tsx` |
| `/academics/curriculum` | `src/app/academics/curriculum/page.tsx` |
| `/academics/faculty` | `src/app/academics/faculty/page.tsx` |
| `/academics/question-papers` | `src/app/academics/question-papers/page.tsx` |
| `/academics/results` | `src/app/academics/results/page.tsx` |
| `/contact` | `src/app/contact/page.tsx` |
| `/gallery` | `src/app/gallery/page.tsx` |
| `/sports` | `src/app/sports/page.tsx` |

## 🎨 Component Hierarchy

```
RootLayout (layout.tsx)
├── Navbar (components/Navbar.tsx)
│   ├── Logo
│   ├── Navigation Links
│   │   ├── Home
│   │   ├── About (Dropdown)
│   │   ├── Admissions (Dropdown)
│   │   ├── Academics (Dropdown)
│   │   ├── Sports
│   │   ├── Gallery
│   │   └── Contact
│   ├── Student/Staff/Admin Buttons
│   └── Social Media Links
│
├── Main Content (children)
│   └── [Page Components]
│
└── Footer (components/Footer.tsx)
    ├── School Info
    ├── Quick Links
    ├── Contact Info
    └── Social Icons
```

## 📦 Key Technologies

- **Next.js 14.2.5** - React framework with App Router
- **TypeScript 5.4.5** - Type safety
- **Tailwind CSS 3.4.1** - Utility-first CSS
- **React 18.2** - UI library

## 🔧 Import Alias

- `@/*` → `./src/*`
- Example: `import Navbar from "@/components/Navbar"`

## 🎨 Design System

- **Primary Color**: `#0d1b2a` (Dark Blue)
- **Accent Color**: `#d4af37` (Gold)
- **Background**: `slate-50`
- **Font**: Inter (Google Fonts)


