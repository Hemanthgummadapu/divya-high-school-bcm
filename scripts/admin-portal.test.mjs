import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_PORTAL_MODULES,
  COMING_SOON_LABEL,
  FORBIDDEN_ADMIN_PLACEHOLDERS,
  QUESTION_BANK_HREF,
  getAvailableAdminModules,
  getComingSoonAdminModules,
  isComingSoonAdminModule,
} from "../src/lib/admin-portal-nav.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function collectSourceFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(path));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const landing = read("src/app/admin-portal/page.tsx");
const comingSoon = read("src/app/admin-portal/[module]/page.tsx");
const shell = read("src/components/AdminPortalShell.tsx");
const layout = read("src/app/admin-portal/layout.tsx");
const logout = read("src/components/PortalLogoutButton.tsx");
const middleware = read("src/middleware.ts");

const REQUIRED_COMING_SOON = [
  "User Management",
  "Fee Management",
  "Reports",
  "Settings",
  "Announcements",
  "Attendance Overview",
];

test("Question Bank is the only active admin module", () => {
  const available = getAvailableAdminModules();
  assert.equal(available.length, 1);
  assert.equal(available[0].title, "Question Bank");
  assert.equal(available[0].available, true);
  assert.equal(getComingSoonAdminModules().length, ADMIN_PORTAL_MODULES.length - 1);
});

test("Question Bank links exactly to /academics/question-papers", () => {
  const [questionBank] = getAvailableAdminModules();
  assert.equal(QUESTION_BANK_HREF, "/academics/question-papers");
  assert.equal(questionBank.href, "/academics/question-papers");
  assert.match(landing, /Open Question Bank/);
  assert.match(landing, /QUESTION_BANK_HREF/);
  assert.match(shell, /href=\{item\.href\}/);
  assert.doesNotMatch(landing, /Previous Question Papers/);
  assert.doesNotMatch(shell, /Previous Question Papers/);
});

test("every other module visibly says Coming Soon and cannot perform an action", () => {
  const comingSoonModules = getComingSoonAdminModules();
  assert.deepEqual(
    comingSoonModules.map((item) => item.title),
    REQUIRED_COMING_SOON,
  );
  for (const item of comingSoonModules) {
    assert.equal(item.available, false);
    assert.equal(isComingSoonAdminModule(item.id), true);
  }
  assert.match(shell, /\{item\.title\}/);
  assert.match(shell, /COMING_SOON_LABEL/);
  assert.match(shell, /aria-disabled="true"/);
  assert.match(shell, /cursor-not-allowed/);
  assert.equal(COMING_SOON_LABEL, "Coming Soon");
  assert.doesNotMatch(shell, /onClick=\{\(\) => setActiveId/);
  assert.doesNotMatch(shell, /href="#"/);
});

test("direct unavailable-module routes render a safe Coming Soon state", () => {
  assert.match(comingSoon, /COMING_SOON_LABEL/);
  assert.match(comingSoon, /is not available yet/);
  assert.match(comingSoon, /does not collect data/);
  assert.match(comingSoon, /notFound\(\)/);
  assert.match(comingSoon, /redirect\(item\.href\)/);
  assert.doesNotMatch(comingSoon, /<form/);
  assert.doesNotMatch(comingSoon, /<input/);
  assert.doesNotMatch(comingSoon, /<select/);
  assert.doesNotMatch(comingSoon, /<textarea/);
  assert.doesNotMatch(comingSoon, /Total Students|Fees Collected|Attendance %/);
});

test("no fabricated numbers or statistics remain in the admin portal", () => {
  const adminFiles = [
    "src/lib/admin-portal-nav.mjs",
    "src/app/admin-portal/page.tsx",
    "src/app/admin-portal/layout.tsx",
    "src/app/admin-portal/[module]/page.tsx",
    "src/components/AdminPortalShell.tsx",
  ];
  for (const file of adminFiles) {
    const source = read(file);
    for (const value of FORBIDDEN_ADMIN_PLACEHOLDERS) {
      if (file.endsWith("admin-portal-nav.mjs") && source.includes(value)) {
        assert.match(source, /FORBIDDEN_ADMIN_PLACEHOLDERS/);
        continue;
      }
      assert.equal(
        source.includes(value),
        false,
        `${file} still contains ${value}`,
      );
    }
    if (!file.endsWith("admin-portal-nav.mjs")) {
      assert.doesNotMatch(source, /Total Students|Total Staff|Fees Collected/);
      assert.doesNotMatch(source, /vs last term|Fully staffed/);
    }
  }
});

test("signed-in identity and logout still work", () => {
  assert.match(shell, /Signed in as/);
  assert.match(shell, /session\?\.user\?\.email/);
  assert.match(shell, /<PortalLogoutButton/);
  assert.match(layout, /AdminPortalShell/);
  assert.match(logout, /signOut\(\{ callbackUrl: "\/login" \}\)/);
  assert.doesNotMatch(shell, /admin@divyahighschool\.co\.in/);
});

test("anonymous and authorized access rules are unchanged", () => {
  assert.match(middleware, /pathname\.startsWith\("\/admin-portal"\)/);
  assert.match(middleware, /"\/admin-portal"/);
  assert.match(middleware, /"\/admin-portal\/:path\*"/);
  assert.match(middleware, /evaluateQuestionPaperIdentity/);
  assert.match(middleware, /authorized: \(\{ token \}\) => !!token/);
});

test("admin layout covers mobile, tablet, laptop, and desktop widths", () => {
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /lg:static/);
  assert.match(shell, /lg:translate-x-0/);
  assert.match(shell, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(shell, /overflow-x-hidden/);
  assert.match(shell, /min-h-11/);
  assert.match(shell, /focus-visible:ring-2/);
  assert.match(landing, /max-w-3xl/);
  assert.match(landing, /sm:text-4xl/);
});

test("repository search finds no remaining fabricated admin statistics", () => {
  const searchRoots = ["src", "scripts"].map((dir) => join(root, dir));
  const hits = [];
  for (const searchRoot of searchRoots) {
    if (!statSync(searchRoot, { throwIfNoEntry: false })) continue;
    for (const file of collectSourceFiles(searchRoot)) {
      const source = readFileSync(file, "utf8");
      const relative = file.slice(root.length + 1);
      if (relative.endsWith("admin-portal-nav.mjs")) continue;
      if (relative.endsWith("admin-portal.test.mjs")) continue;
      for (const value of FORBIDDEN_ADMIN_PLACEHOLDERS) {
        if (source.includes(value)) hits.push(`${relative}: ${value}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
