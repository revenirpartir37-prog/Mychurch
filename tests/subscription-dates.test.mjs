import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, addMonths, addYears } from 'date-fns'

// Direct mirror of calculateSubscriptionEndDate logic for testing pure calculation
function calculateSubscriptionEndDate(plan, existingEndDate, refDate = new Date()) {
  let baseDate = refDate

  if (existingEndDate) {
    const parsed = new Date(existingEndDate)
    if (!isNaN(parsed.getTime()) && parsed.getTime() > refDate.getTime()) {
      baseDate = parsed
    }
  }

  switch (plan) {
    case 'lifetime':
      return new Date('2099-12-31T23:59:59.999Z')
    case 'trial':
      return addDays(baseDate, 7)
    case 'monthly':
      return addMonths(baseDate, 1)
    case 'annual':
    case 'annual_branch':
      return addYears(baseDate, 1)
    default:
      return addMonths(baseDate, 1)
  }
}

function safeFormatDate(d, plan) {
  if (plan === 'lifetime') return 'À vie (Illimité)'
  if (!d) return '—'
  const parsed = new Date(d)
  if (isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

test('calculateSubscriptionEndDate gives exactly 7 days for trial', () => {
  const base = new Date('2026-09-17T12:00:00.000Z')
  const result = calculateSubscriptionEndDate('trial', null, base)
  const diffDays = Math.round((result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
  assert.equal(diffDays, 7)
})

test('calculateSubscriptionEndDate gives 1 month for monthly without month skipping', () => {
  // Test case on January 31: adding 1 month must NOT roll into March
  const jan31 = new Date('2026-01-31T12:00:00.000Z')
  const febResult = calculateSubscriptionEndDate('monthly', null, jan31)
  // Feb 2026 has 28 days
  assert.equal(febResult.getUTCMonth(), 1) // 1 = February
  assert.equal(febResult.getUTCDate(), 28)
})

test('calculateSubscriptionEndDate for March 31 does not skip April', () => {
  const mar31 = new Date('2026-03-31T12:00:00.000Z')
  const aprResult = calculateSubscriptionEndDate('monthly', null, mar31)
  assert.equal(aprResult.getUTCMonth(), 3) // 3 = April
  assert.equal(aprResult.getUTCDate(), 30)
})

test('calculateSubscriptionEndDate preserves remaining days when renewing active subscription', () => {
  const now = new Date('2026-09-17T12:00:00.000Z')
  // Current subscription has 10 days left (ends Sept 27)
  const existingEnd = new Date('2026-09-27T12:00:00.000Z')
  const renewed = calculateSubscriptionEndDate('monthly', existingEnd, now)

  // Must end on Oct 27 (1 month from existingEnd, NOT from now)
  assert.equal(renewed.getUTCMonth(), 9) // 9 = October
  assert.equal(renewed.getUTCDate(), 27)
})

test('calculateSubscriptionEndDate starts from now if previous subscription already expired', () => {
  const now = new Date('2026-09-17T12:00:00.000Z')
  const expiredEnd = new Date('2026-09-01T12:00:00.000Z')
  const renewed = calculateSubscriptionEndDate('monthly', expiredEnd, now)

  // Must end 1 month from now (Oct 17)
  assert.equal(renewed.getUTCMonth(), 9) // 9 = October
  assert.equal(renewed.getUTCDate(), 17)
})

test('calculateSubscriptionEndDate returns 2099 for lifetime plan', () => {
  const result = calculateSubscriptionEndDate('lifetime')
  assert.equal(result.getUTCFullYear(), 2099)
})

test('safeFormatDate formats lifetime plan correctly without showing 2099', () => {
  const formatted = safeFormatDate('2099-12-31T23:59:59.999Z', 'lifetime')
  assert.equal(formatted, 'À vie (Illimité)')
})

test('safeFormatDate handles invalid dates and null without crashing', () => {
  assert.equal(safeFormatDate(null), '—')
  assert.equal(safeFormatDate(undefined), '—')
  assert.equal(safeFormatDate('invalid-date-string'), '—')
  assert.equal(safeFormatDate(''), '—')
})
