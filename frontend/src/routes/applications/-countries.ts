import countries from 'i18n-iso-countries'
import english from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(english)

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

export function isCountryName(value: string): boolean {
  return countryNames.has(value)
}
