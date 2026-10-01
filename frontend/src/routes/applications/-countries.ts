import countries from 'i18n-iso-countries'
import english from 'i18n-iso-countries/langs/en.json'
import nationalities from 'i18n-nationality'
import englishNationalities from 'i18n-nationality/langs/en.json'

countries.registerLocale(english)
nationalities.registerLocale(englishNationalities)

const collator = new Intl.Collator('en', { sensitivity: 'base' })

export const countryOptions = Object.entries(
  countries.getNames('en', { select: 'official' }),
)
  .map(([code, name]) => ({
    code,
    label: name,
    textValue: (
      countries.getName(code, 'en', { select: 'all' }) ?? [name]
    ).join(' '),
    value: name,
  }))
  .sort((left, right) => collator.compare(left.label, right.label))

const countryNames = new Set(countryOptions.map(({ value }) => value))

const nationalitySearchTerms = new Map<string, Set<string>>()
for (const [code, nationality] of Object.entries(
  nationalities.getNames('en'),
)) {
  const terms = nationalitySearchTerms.get(nationality) ?? new Set<string>()
  terms.add(nationality)
  terms.add(code)
  const country = countries.getName(code, 'en')
  if (country) terms.add(country)
  nationalitySearchTerms.set(nationality, terms)
}

export const nationalityOptions = [...nationalitySearchTerms.entries()]
  .map(([nationality, terms]) => ({
    label: nationality,
    textValue: [...terms].join(' '),
    value: nationality,
  }))
  .sort((left, right) => collator.compare(left.label, right.label))

const nationalityNames = new Set(nationalityOptions.map(({ value }) => value))

export function isCountryName(value: string): boolean {
  return countryNames.has(value)
}

export function isNationalityName(value: string): boolean {
  return nationalityNames.has(value)
}
