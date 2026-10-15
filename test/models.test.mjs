import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelLimits } from '../dist/limits.js'
import { buildOpenCodeModels, discoverModels } from '../dist/models.js'

const model = { id: 'glm-5.3-flash', display_name: 'GLM 5.3 Flash', context_length: 1048576, enabled: true, status: 'available', is_free: false, price_sc_input: 26, price_sc_output: 65 }

test('setup preserves a 1M context without inventing a 524288-token output limit', () => {
  assert.deepEqual(buildOpenCodeModels([model]), {
    'glm-5.3-flash': { name: 'GLM 5.3 Flash', limit: { context: 1048576, output: 32000 } },
  })
  assert.deepEqual(buildOpenCodeModels([{ ...model, enabled: false }, { ...model, status: 'planned' }]), {})
})

test('invalid contexts get a valid fallback; small contexts bound output', () => {
  for (const value of [null, undefined, 0, -1, NaN, Infinity, 1.5, '1048576']) {
    assert.deepEqual(modelLimits(value), { context: 32768, output: 32000 })
  }
  assert.deepEqual(modelLimits(4096), { context: 4096, output: 4096 })
  assert.deepEqual(modelLimits(131072), { context: 131072, output: 32000 })
})

test('discovery and CLI use the same budget, exact IDs and catalogue prices', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'http://fixture.invalid/api/models')
    return new Response(JSON.stringify([model, { ...model, id: 'disabled', enabled: false }]))
  })
  const result = await discoverModels('http://fixture.invalid/v1')
  assert.deepEqual(Object.keys(result), [model.id])
  assert.equal(result[model.id].contextLength, 1048576)
  assert.equal(result[model.id].maxOutputTokens, buildOpenCodeModels([model])[model.id].limit.output)
  assert.equal(result[model.id].priceSCOutput, 65)
})
