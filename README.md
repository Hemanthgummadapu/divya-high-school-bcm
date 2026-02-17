# Divya High School BCM - Website

A clean, production-ready Next.js 14 website for Divya High School BCM.

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **ESLint** for code quality

## Project Structure

```
divya-high-school-bcm/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout with Navbar and Footer
│   │   ├── page.tsx           # Home page (/)
│   │   ├── about/
│   │   │   └── page.tsx       # About page (/about)
│   │   ├── admissions/
│   │   │   └── page.tsx       # Admissions page (/admissions)
│   │   ├── contact/
│   │   │   └── page.tsx       # Contact page (/contact)
│   │   └── gallery/
│   │       └── page.tsx       # Gallery page (/gallery)
│   ├── components/            # Reusable UI components
│   │   ├── Navbar.tsx         # Navigation bar component
│   │   ├── Footer.tsx         # Footer component
│   │   └── Hero.tsx           # Hero section component
│   ├── styles/                # Global styles
│   │   └── globals.css        # Tailwind CSS imports and global styles
│   └── lib/                   # Utility functions (reserved for future use)
├── .eslintrc.json             # ESLint configuration
├── .gitignore                 # Git ignore rules
├── next.config.js             # Next.js configuration
├── package.json               # Dependencies and scripts
├── postcss.config.mjs         # PostCSS configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── tsconfig.json              # TypeScript configuration
```

## Directory Explanations

### `src/app/`
Contains all route pages using Next.js 14 App Router. Each folder represents a route, and `page.tsx` files define the page components. The `layout.tsx` file wraps all pages with common elements (Navbar, Footer).

### `src/components/`
Reusable React components that can be used across multiple pages. Currently includes:
- **Navbar**: Site navigation with links to all main pages
- **Footer**: Site footer with quick links and contact information
- **Hero**: Hero section component for the home page

### `src/styles/`
Global styles and Tailwind CSS configuration. The `globals.css` file imports Tailwind directives.

### `src/lib/`
Reserved for future utility functions, helpers, and shared logic. Currently empty and ready for expansion.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Import Alias

The project uses `@/*` as an import alias pointing to `src/*`. Example:
```typescript
import Navbar from "@/components/Navbar";
import "@/styles/globals.css";
```

## Collaboration Guidelines

This repository is designed for collaborative development:

- **UI/UX Developer**: Focus on styling and component design in `src/components/` and page content in `src/app/`
- **Architecture Developer**: Handle project structure, configuration, and future utility functions in `src/lib/`

### Git Workflow

- Keep commits small and meaningful
- Use feature branches for new work
- UI-focused work can be done in separate branches without affecting architecture

## Current Status

✅ All pages scaffolded and functional
✅ Basic components created (Navbar, Footer, Hero)
✅ Tailwind CSS configured
✅ TypeScript configured with path aliases
✅ ESLint enabled
✅ No backend logic, database, or authentication (UI-only)

## Next Steps

- Add content to each page
- Enhance component styling
- Add images and media assets
- Implement responsive design improvements
- Add utility functions to `src/lib/` as needed

