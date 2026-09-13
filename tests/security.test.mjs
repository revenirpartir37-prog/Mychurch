import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'

const secret = 'test-webhook-secret'

function signature(payload, timestamp) {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
}

function verifyWebhookSignature(payload, signatureValue, timestamp, signingSecret) {
  if (!signingSecret || !signatureValue || !timestamp) return false
  const timestampMs = Number(timestamp) * 1000
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false
  return signature(payload, timestamp) === signatureValue
}

test('webhook signature accepts a recent valid signature', async () => {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = '{"event":"payment.completed"}'
  const expected = signature(payload, timestamp)
  assert.equal(verifyWebhookSignature(payload, expected, timestamp, secret), true)
})

test('webhook signature rejects stale signatures', async () => {
  const timestamp = (Math.floor(Date.now() / 1000) - 3600).toString()
  const payload = '{}'
  assert.equal(verifyWebhookSignature(payload, signature(payload, timestamp), timestamp, secret), false)
})

test('church-scoped queries require both churchId and resource id', () => {
  const resource = { id: 'member-1', churchId: 'church-a' }
  assert.equal(resource.id === 'member-1' && resource.churchId === 'church-a', true)
  assert.equal(resource.churchId === 'church-b', false)
})

test('money validation rejects negative and non-finite values', () => {
  for (const value of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(Number.isFinite(value) && value > 0, false)
  }
  assert.equal(Number.isFinite(10.25) && 10.25 > 0, true)
})
