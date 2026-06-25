import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

async function getApiKey(): Promise<string | undefined> {
  // 1. Environment variable
  if (process.env.SIMPLELLM_API_KEY) return process.env.SIMPLELLM_API_KEY

  // 2. OpenCode auth.json (written by /connect or our CLI)
  try {
    const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json')
    const auth = JSON.parse(await readFile(authPath, 'utf-8'))
    if (auth.simplellm) return auth.simplellm
  } catch {}

  return undefined
}

async function getBaseURL(): Promise<string> {
  if (process.env.SIMPLELLM_BASE_URL) {
    return process.env.SIMPLELLM_BASE_URL.replace(/\/v1\/?$/, '')
  }

  // Read from opencode config
  try {
    const configPath = join(homedir(), '.config', 'opencode', 'opencode.json')
    const config = JSON.parse(await readFile(configPath, 'utf-8'))
    const url = config?.provider?.simplellm?.options?.baseURL
    if (url) return url.replace(/\/v1\/?$/, '')
  } catch {}

  return 'http://localhost:8099'
}

/**
 * OpenCode plugin for SimpleLLM.
 * Shows credit balance on session start, guides setup if not configured.
 */
export const SimpleLLMPlugin = async () => {
  const baseURL = await getBaseURL()
  const apiKey = await getApiKey()

  return {
    name: 'simplellm',

    hooks: {
      'session.created': async () => {
        if (!apiKey) {
          return {
            toast: {
              message: 'SimpleLLM: Not configured. Run: npx @simplellm/opencode-provider',
              variant: 'warning' as const,
            },
          }
        }

        try {
          const res = await fetch(`${baseURL}/v1/usage`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (!res.ok) return
          const data: { balance?: number } = await res.json()
          if (data.balance == null) return

          return {
            toast: {
              message: `SimpleLLM: ${data.balance.toLocaleString()} SC`,
              variant: data.balance < 100 ? 'warning' : ('info' as const),
            },
          }
        } catch {
          return {
            toast: {
              message: `SimpleLLM: Could not reach ${baseURL}`,
              variant: 'warning' as const,
            },
          }
        }
      },
    },
  }
}
