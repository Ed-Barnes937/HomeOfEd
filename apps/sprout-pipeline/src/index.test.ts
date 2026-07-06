import { expect, test } from 'vitest'

import { buildServer } from './index.ts'

test('GET /health returns { ok: true }', async () => {
  const app = buildServer()
  const res = await app.inject({ method: 'GET', url: '/health' })

  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ ok: true })

  await app.close()
})
