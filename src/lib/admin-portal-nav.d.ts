export const QUESTION_BANK_HREF: "/academics/question-papers";
export const COMING_SOON_LABEL: "Coming Soon";
export const FORBIDDEN_ADMIN_PLACEHOLDERS: readonly string[];

export type AdminPortalModule = {
  id: string;
  title: string;
  description: string;
  href: string;
  available: boolean;
  icon: string;
};

export const ADMIN_PORTAL_MODULES: readonly AdminPortalModule[];

export function getAvailableAdminModules(): AdminPortalModule[];
export function getComingSoonAdminModules(): AdminPortalModule[];
export function getAdminModuleById(id: string): AdminPortalModule | null;
export function isComingSoonAdminModule(id: string): boolean;
