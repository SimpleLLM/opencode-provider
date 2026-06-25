/** Model info as returned by SimpleLLM's /api/models endpoint */
export interface SimpleLLMModelInfo {
  id: string
  display_name: string | null
  description: string | null
  context_length: number | null
  price_sc_input: number
  price_sc_output: number
  tier: 'free' | 'standard' | 'premium'
  is_free: boolean
  enabled: boolean
  status: 'available' | 'planned'
}

/** Resolved model config for OpenCode */
export interface ModelConfig {
  name: string
  contextLength: number
  maxOutputTokens: number
  displayName?: string
  isFree: boolean
  priceSCInput: number
  priceSCOutput: number
}

/** Options for creating the SimpleLLM provider */
export interface SimpleLLMConfig {
  /** Base URL for the SimpleLLM API (default: SIMPLELLM_BASE_URL or http://localhost:8099/v1) */
  baseURL?: string
  /** API key for authentication (default: SIMPLELLM_API_KEY) */
  apiKey?: string
}
