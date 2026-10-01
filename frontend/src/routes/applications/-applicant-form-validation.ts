import type { ApplicantApplicationStep } from './-applicant-application-api'
import type {
  ApplicantFormAnswerName,
  ApplicantFormAnswers,
} from './-applicant-form-api'

export type ApplicantFormValidationErrors = Partial<
  Record<ApplicantFormAnswerName, string>
>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneCharactersPattern = /^\+?[0-9 ().-]+$/

const maximumLengths: Partial<Record<ApplicantFormAnswerName, number>> = {
  name: 100,
  country: 100,
  nationality: 100,
  email: 254,
  phone: 30,
  documentType: 100,
  documentNumber: 100,
  documentCountry: 100,
  street: 200,
  city: 100,
  postal: 32,
  residentialCountry: 100,
}

const stepFields: Record<
  ApplicantApplicationStep,
  readonly ApplicantFormAnswerName[]
> = {
  'personal-details': [
    'name',
    'dateOfBirth',
    'country',
    'nationality',
    'email',
    'phone',
    'consentConfirmed',
  ],
  'identity-and-address': [
    'documentType',
    'documentNumber',
    'documentCountry',
    'expiry',
    'street',
    'city',
    'postal',
    'residentialCountry',
  ],
}

export function normalizeApplicantFormAnswers(
  answers: ApplicantFormAnswers,
): ApplicantFormAnswers {
  return Object.fromEntries(
    Object.entries(answers).map(([name, value]) => [
      name,
      typeof value === 'string' ? value.trim() : value,
    ]),
  ) as ApplicantFormAnswers
}

export function validateApplicantFormStep(
  step: ApplicantApplicationStep,
  answers: ApplicantFormAnswers,
  today = localIsoDate(),
): ApplicantFormValidationErrors {
  const normalized = normalizeApplicantFormAnswers(answers)
  const errors: ApplicantFormValidationErrors = {}

  for (const name of stepFields[step]) {
    if (name === 'consentConfirmed') {
      if (!normalized.consentConfirmed) {
        errors.consentConfirmed = 'Confirm that these details are accurate.'
      }
      continue
    }

    const value = normalized[name] ?? ''
    if (!value) {
      errors[name] = 'Enter a value.'
      continue
    }

    const maximumLength = maximumLengths[name]
    if (maximumLength !== undefined && value.length > maximumLength) {
      errors[name] = `Use ${maximumLength} characters or fewer.`
    }
  }

  if (!errors.email && step === 'personal-details') {
    const email = normalized.email ?? ''
    if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.'
  }

  if (!errors.phone && step === 'personal-details') {
    const phone = normalized.phone ?? ''
    const digitCount = phone.replace(/\D/g, '').length
    if (!phoneCharactersPattern.test(phone) || digitCount < 7) {
      errors.phone = 'Enter a valid phone number using at least 7 digits.'
    }
  }

  if (!errors.dateOfBirth && step === 'personal-details') {
    const dateOfBirth = normalized.dateOfBirth ?? ''
    if (!isIsoCalendarDate(dateOfBirth)) {
      errors.dateOfBirth = 'Enter a valid date of birth.'
    } else if (dateOfBirth > today) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.'
    }
  }

  if (!errors.expiry && step === 'identity-and-address') {
    const expiry = normalized.expiry ?? ''
    if (!isIsoCalendarDate(expiry)) {
      errors.expiry = 'Enter a valid expiry date.'
    } else if (expiry < today) {
      errors.expiry = 'Expiry date cannot be in the past.'
    }
  }

  return errors
}

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function localIsoDate(): string {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
