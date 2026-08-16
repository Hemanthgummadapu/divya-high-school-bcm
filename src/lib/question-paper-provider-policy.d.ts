export const QUESTION_PAPER_PARSER_PROVIDER: "anthropic";
export const QUESTION_PAPER_PARSER_MODEL: "claude-sonnet-4-6";
export const QUESTION_PAPER_PARSER_ENV: "ANTHROPIC_API_KEY";

export function isAnthropicConfigured(value: unknown): boolean;
export function resolveQuestionPaperParser(untrustedProvider?: unknown): {
  provider: "anthropic";
  model: "claude-sonnet-4-6";
  envName: "ANTHROPIC_API_KEY";
};
