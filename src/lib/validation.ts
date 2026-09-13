import { z } from 'zod'

export const isoDate = z.string().datetime({ offset: true })
export const money = z.number().finite().positive().max(999_999_999_999.99)

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}