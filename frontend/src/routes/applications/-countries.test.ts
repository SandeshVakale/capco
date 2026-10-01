import { describe, expect, it } from 'vitest'

import {
  countryOptions,
  isCountryName,
  isNationalityName,
  nationalityOptions,
} from './-countries'

describe('country and nationality reference data', () => {
  it('provides canonical country names and searchable aliases', () => {
    const unitedKingdom = countryOptions.find(
      ({ value }) => value === 'United Kingdom',
    )

    expect(unitedKingdom?.textValue).toContain('UK')
    expect(isCountryName('United Kingdom')).toBe(true)
    expect(isCountryName('UK')).toBe(false)
  })

  it('provides unique nationality adjectives searchable by country', () => {
    const values = nationalityOptions.map(({ value }) => value)
    const indian = nationalityOptions.find(({ value }) => value === 'Indian')

    expect(new Set(values).size).toBe(values.length)
    expect(indian?.textValue).toContain('India')
    expect(isNationalityName('Indian')).toBe(true)
    expect(isNationalityName('India')).toBe(false)
  })
})
