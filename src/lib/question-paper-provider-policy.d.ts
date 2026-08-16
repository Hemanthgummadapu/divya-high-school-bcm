export const QUESTION_PAPER_PARSER_PROVIDER: "anthropic";
export const QUESTION_PAPER_PARSER_MODEL: "claude-haiku-4-5-20251001";
export const QUESTION_PAPER_PARSER_ENV: "ANTHROPIC_API_KEY";

export function isAnthropicConfigured(value: unknown): boolean;
export function resolveQuestionPaperParser(untrustedProvider?: unknown): {
  provider: "anthropic";
  model: "claude-haiku-4-5-20251001";
  envName: "ANTHROPIC_API_KEY";
};
