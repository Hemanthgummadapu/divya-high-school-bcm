export const QUESTION_PAPER_PARSER_PROVIDER = "anthropic";
export const QUESTION_PAPER_PARSER_MODEL = "claude-haiku-4-5-20251001";
export const QUESTION_PAPER_PARSER_ENV = "ANTHROPIC_API_KEY";

export function isAnthropicConfigured(value) {
  if (typeof value !== "string") return false;
  const key = value.trim();
  return Boolean(key) && key !== "your_key_here";
}

/**
 * Question-paper extraction is Anthropic-only. Untrusted request fields
 * cannot select a provider or model.
 */
export function resolveQuestionPaperParser(_untrustedProvider) {
  return {
    provider: QUESTION_PAPER_PARSER_PROVIDER,
    model: QUESTION_PAPER_PARSER_MODEL,
    envName: QUESTION_PAPER_PARSER_ENV,
  };
}
