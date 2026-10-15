// /api/models exposes context length, not a verified maximum output length.
// Use an explicit OpenCode-default setup budget instead of guessing half the context.
export const DEFAULT_OUTPUT_BUDGET = 32000
export const DEFAULT_CONTEXT_LENGTH = 32768

export function modelLimits(contextLength: number | null | undefined) {
  const context = typeof contextLength === 'number' && Number.isSafeInteger(contextLength) && contextLength > 0
    ? contextLength : DEFAULT_CONTEXT_LENGTH
  return { context, output: Math.min(DEFAULT_OUTPUT_BUDGET, context) }
}
