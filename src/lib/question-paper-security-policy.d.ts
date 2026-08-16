export interface QuestionPaperIdentityInput {
  sessionPresent: boolean;
  email?: string | null;
  emailVerified?: boolean;
  allowedEmailsValue?: string;
}

export interface QuestionPaperPolicyResult {
  allowed: boolean;
  status: 200 | 401 | 403;
  reason:
    | "authentication_required"
    | "authorization_not_configured"
    | "verified_email_required"
    | "account_not_allowed"
    | "authorized";
}

export const QUESTION_PAPER_AUTHORIZED_EMAIL: "info@divyahighschool.co.in";

export function normalizeEmail(value: unknown): string;
export function isSafeQuestionPaperResourceId(value: unknown): boolean;
export function isVerifiedGoogleIdentity(input: {
  provider?: string | null;
  profile?: unknown;
  email?: string | null;
}): boolean;
export function parseAllowedEmails(value: unknown): {
  configured: boolean;
  emails: Set<string>;
};
export function evaluateQuestionPaperIdentity(
  input: QuestionPaperIdentityInput,
): QuestionPaperPolicyResult;
export function isTrustedMutationOrigin(input: {
  origin?: string | null;
  requestOrigin?: string;
  trustedOriginsValue?: string;
  secFetchSite?: string | null;
}): boolean;
