const EMAIL_LOCAL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

function isValidAllowlistEmail(email) {
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    !EMAIL_LOCAL_PATTERN.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return false;
  }
  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[A-Za-z0-9-]+$/.test(label) &&
        !label.startsWith("-") &&
        !label.endsWith("-"),
    )
  );
}

export const QUESTION_PAPER_AUTHORIZED_EMAIL = "info@divyahighschool.co.in";

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isSafeQuestionPaperResourceId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function isVerifiedGoogleIdentity({ provider, profile, email }) {
  if (
    provider !== "google" ||
    !profile ||
    typeof profile !== "object" ||
    profile.email_verified !== true
  ) {
    return false;
  }
  const profileEmail = normalizeEmail(profile.email);
  return Boolean(profileEmail) && profileEmail === normalizeEmail(email);
}

export function parseAllowedEmails(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { configured: false, emails: new Set() };
  }

  const entries = value.split(",").map(normalizeEmail);

  if (
    entries.length === 0 ||
    entries.some((email) => !email || !isValidAllowlistEmail(email))
  ) {
    return { configured: false, emails: new Set() };
  }

  return { configured: true, emails: new Set(entries) };
}

export function evaluateQuestionPaperIdentity({
  sessionPresent,
  email,
  emailVerified,
  allowedEmailsValue,
}) {
  if (!sessionPresent) {
    return { allowed: false, status: 401, reason: "authentication_required" };
  }

  const allowedEmails = parseAllowedEmails(allowedEmailsValue);
  if (!allowedEmails.configured) {
    return { allowed: false, status: 403, reason: "authorization_not_configured" };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || emailVerified !== true) {
    return { allowed: false, status: 403, reason: "verified_email_required" };
  }

  if (
    normalizedEmail !== QUESTION_PAPER_AUTHORIZED_EMAIL ||
    !allowedEmails.emails.has(normalizedEmail)
  ) {
    return { allowed: false, status: 403, reason: "account_not_allowed" };
  }

  return { allowed: true, status: 200, reason: "authorized" };
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  try {
    const parsed = new URL(value.trim());
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search ||
      parsed.hash
    ) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

export function isTrustedMutationOrigin({
  origin,
  requestOrigin,
  trustedOriginsValue,
  secFetchSite,
}) {
  if (origin == null || origin.trim() === "") {
    return secFetchSite === "same-origin";
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const trustedOrigins = new Set();
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (normalizedRequestOrigin) trustedOrigins.add(normalizedRequestOrigin);

  if (typeof trustedOriginsValue === "string") {
    for (const value of trustedOriginsValue.split(",")) {
      const normalized = normalizeOrigin(value);
      if (normalized) trustedOrigins.add(normalized);
    }
  }

  return trustedOrigins.has(normalizedOrigin);
}
