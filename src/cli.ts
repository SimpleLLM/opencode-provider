#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { SimpleLLMModelInfo } from './types'
import { buildOpenCodeModels } from './models.js'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve))

// Override via SIMPLELLM_BASE_URL for non-production setups.
const BASE_URL = process.env.SIMPLELLM_BASE_URL ?? 'https://api.simplellm.eu'

const OPENCODE_CONFIG = join(homedir(), '.config', 'opencode', 'opencode.json')
const OPENCODE_AUTH = join(homedir(), '.local', 'share', 'opencode', 'auth.json')

async function readJSON(path: string): Promise<Record<string, any>> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch {
    return {}
  }
}

async function writeJSON(path: string, data: Record<string, any>) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2) + '\n')
}

async function main() {
  console.log()
  console.log('  SimpleLLM + OpenCode Setup')
  console.log('  ─────────────────────────')
  console.log()

  const baseURL = BASE_URL
  const apiURL = `${baseURL}/v1`

  // 1. Fetch models
  console.log(`  Connecting to ${baseURL}...`)

  let models: SimpleLLMModelInfo[]
  try {
    const res = await fetch(`${baseURL}/api/models`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    models = await res.json()
  } catch {
    console.error(`  Could not reach ${baseURL}`)
    console.error('  Is SimpleLLM running?')
    process.exit(1)
  }

  const enabled = models.filter((m) => m.enabled)
  const available = enabled.filter((m) => m.status !== 'planned')
  const premium = models.filter((m) => m.status === 'planned')

  console.log(`  ${available.length} model${available.length !== 1 ? 's' : ''} available:`)
  for (const m of available) {
    const label = m.display_name ?? m.id
    const tag = m.is_free ? ' (free)' : ` (SC ${m.price_sc_input}/${m.price_sc_output})`
    console.log(`    - ${label}${tag}`)
  }
  if (premium.length > 0) {
    console.log(`  ${premium.length} coming soon:`)
    for (const m of premium) {
      console.log(`    - ${m.display_name ?? m.id}`)
    }
  }
  console.log()

  // 3. API Key
  const apiKey = (await ask('  API Key: ')).trim()
  if (!apiKey) {
    console.error('  API key is required.')
    process.exit(1)
  }

  // Validate
  try {
    const res = await fetch(`${apiURL}/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: { balance?: number } = await res.json()
    if (data.balance != null) {
      console.log(`  Balance: ${data.balance.toLocaleString()} SC`)
    }
  } catch {
    console.error('  Warning: Could not validate key. Saving anyway.')
  }
  console.log()

  // 4. Build model config (skip planned)
  const modelConfig = buildOpenCodeModels(available)

  // 5. Write opencode config
  const existingConfig = await readJSON(OPENCODE_CONFIG)
  const defaultModelId = available.find((m) => m.id === 'glm-5.3-flash')?.id
    ?? available[0]?.id
    ?? 'glm-5.3-flash'

  const newConfig = {
    ...existingConfig,
    $schema: 'https://opencode.ai/config.json',
    model: `simplellm/${defaultModelId}`,
    provider: {
      ...(existingConfig.provider ?? {}),
      simplellm: {
        npm: '@ai-sdk/openai-compatible',
        name: 'SimpleLLM',
        options: { baseURL: apiURL },
        models: modelConfig,
      },
    },
  }
  await writeJSON(OPENCODE_CONFIG, newConfig)
  console.log(`  Config: ${OPENCODE_CONFIG}`)

  // 6. Write auth — opencode expects { type: "api", key } entries
  const existingAuth = await readJSON(OPENCODE_AUTH)
  existingAuth.simplellm = { type: 'api', key: apiKey }
  await writeJSON(OPENCODE_AUTH, existingAuth)
  console.log(`  Auth:   ${OPENCODE_AUTH}`)

  // Done
  console.log()
  console.log('  Done! Start OpenCode:')
  console.log()
  const defaultModel = available.find((m) => m.id === 'glm-5.3-flash') ?? available[0]
  console.log(`    opencode --model simplellm/${defaultModel?.id ?? 'glm-5.3-flash'}`)
  console.log()

  rl.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
