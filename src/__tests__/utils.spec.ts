import { describe, it, expect } from 'vitest'
import { formatDate } from '@/lib/utils'

describe('formatDate', () => {
  it('formats ISO string', () => {
    const s = formatDate('2025-11-26T10:00:00.000Z')
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
  })
})
