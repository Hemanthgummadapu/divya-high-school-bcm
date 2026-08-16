import { headers } from "next/headers";

/**
 * Importing next/headers makes Next.js reject client-component imports at
 * compile time. The runtime check remains a second guard for non-Next bundles.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof headers !== "function" || typeof window !== "undefined") {
    throw new Error(`${moduleName} must only be used on the server`);
  }
}
