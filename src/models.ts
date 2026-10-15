import { modelLimits } from './limits.js'
import type { SimpleLLMModelInfo, ModelConfig } from './types'

/**
 * Fetches enabled models from SimpleLLM's public /api/models endpoint
 * and maps them to OpenCode model configs.
 */
export async function discoverModels(
  baseURL?: string,
): Promise<Record<string, ModelConfig>> {
  const base = baseURL ?? process.env.SIMPLELLM_BASE_URL ?? 'http://localhost:8099/v1'
  // /api/models lives at the root, not under /v1
  const apiBase = base.replace(/\/v1\/?$/, '')

  const res = await fetch(`${apiBase}/api/models`)
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`)
  }

  const models: SimpleLLMModelInfo[] = await res.json()
  const config: Record<string, ModelConfig> = {}

  for (const m of models) {
    if (!m.enabled) continue

    const limit = modelLimits(m.context_length)
    config[m.id] = {
      name: m.id,
      contextLength: limit.context,
      maxOutputTokens: limit.output,
      displayName: m.display_name ?? undefined,
      isFree: m.is_free,
      priceSCInput: m.price_sc_input,
      priceSCOutput: m.price_sc_output,
    }
  }

  return config
}

/** Complete OpenCode model entries; keep context and output together. */
export function buildOpenCodeModels(models: SimpleLLMModelInfo[]) {
  return Object.fromEntries(models
    .filter(model => model.enabled && model.status !== 'planned')
    .map(model => [model.id, {
      name: model.display_name ?? model.id,
      limit: modelLimits(model.context_length),
    }]))
}
