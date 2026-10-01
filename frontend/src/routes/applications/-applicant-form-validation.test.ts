import { describe, expect, it } from 'vitest'

import {
  normalizeApplicantFormAnswers,
  validateApplicantFormStep,
} from './-applicant-form-validation'

describe('Applicant form validation', () => {
  it('accepts conservative international personal details', () => {
    expect(
      validateApplicantFormStep(
        'personal-details',
        {
          name: 'Ada Lovelace',
          dateOfBirth: '1990-12-10',
          country: 'United Kingdom',
          nationality: 'British',
          email: 'ada@example.test',
          phone: '+44 (0)20 7946 0958',
          consentConfirmed: true,
        },
        '2026-10-01',
      ),
    ).toEqual({})
  })

  it('rejects whitespace, malformed contact details, and future birth dates', () => {
    expect(
      validateApplicantFormStep(
        'personal-details',
        {
          name: '   ',
          dateOfBirth: '2757-03-31',
          country: 'France',
          nationality: 'Indian',
          email: 'not-an-email',
          phone: 'laheflanla',
          consentConfirmed: false,
        },
        '2026-10-01',
      ),
    ).toEqual({
      name: 'Enter a value.',
      dateOfBirth: 'Date of birth cannot be in the future.',
      email: 'Enter a valid email address.',
      phone: 'Enter a valid phone number using at least 7 digits.',
      consentConfirmed: 'Confirm that these details are accurate.',
    })
  })

  it('requires canonical countries and respects the earliest birth date', () => {
    expect(
      validateApplicantFormStep(
        'personal-details',
        {
          name: 'Ada Lovelace',
          dateOfBirth: '1899-12-31',
          country: 'Atlantis',
          nationality: 'British',
          email: 'ada@example.test',
          phone: '+442079460958',
          consentConfirmed: true,
        },
        '2026-10-01',
      ),
    ).toMatchObject({
      country: 'Choose a country from the list.',
      dateOfBirth: 'Date of birth must be on or after 1 January 1900.',
    })
  })

  it('rejects impossible dates, expired documents, and excessive input', () => {
    expect(
      validateApplicantFormStep(
        'identity-and-address',
        {
          documentType: 'Passport',
          documentNumber: 'A'.repeat(101),
          documentCountry: 'France',
          expiry: '2026-02-29',
          street: '1 Rue de Rivoli',
          city: 'Paris',
          postal: '75001',
          residentialCountry: 'France',
        },
        '2026-10-01',
      ),
    ).toEqual({
      documentNumber: 'Use 100 characters or fewer.',
      expiry: 'Enter a valid expiry date.',
    })

    expect(
      validateApplicantFormStep(
        'identity-and-address',
        {
          documentType: 'Passport',
          documentNumber: 'AB123456',
          documentCountry: 'France',
          expiry: '2026-09-30',
          street: '1 Rue de Rivoli',
          city: 'Paris',
          postal: '75001',
          residentialCountry: 'France',
        },
        '2026-10-01',
      ).expiry,
    ).toBe('Expiry date cannot be in the past.')
  })

  it('trims text before it is submitted without changing boolean answers', () => {
    expect(
      normalizeApplicantFormAnswers({
        name: '  Ada Lovelace  ',
        email: ' ada@example.test ',
        consentConfirmed: true,
      }),
    ).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      consentConfirmed: true,
    })
  })
})
