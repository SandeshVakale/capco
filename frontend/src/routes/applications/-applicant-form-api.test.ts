import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  getApplicantForm,
  presentApplicantFormLoadError,
} from './-applicant-form-api'

const applicationId = '00000000-0000-4000-8000-000000000123'
const formDocument = {
  data: {
    type: 'applicant-application-forms',
    id: applicationId,
    attributes: {
      status: 'draft',
      currentStep: 'identity-and-address',
      steps: [
        { step: 'personal-details', state: 'complete' },
        { step: 'identity-and-address', state: 'current' },
      ],
      answers: {
        name: 'Ada Lovelace',
        dateOfBirth: '1815-12-10',
        country: 'United Kingdom',
        consentConfirmed: true,
        documentNumber: null,
      },
      documentEvidence: { present: true },
      version: 3,
    },
  },
}

describe('Applicant form API', () => {
  it('loads all persisted form state through the authenticated JSON:API contract', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.get(
        `/api/v1/applicant-applications/${applicationId}/form`,
        ({ request }) => {
          capturedRequest = request
          return HttpResponse.json(formDocument)
        },
      ),
    )

    await expect(getApplicantForm(applicationId)).resolves.toEqual({
      id: applicationId,
      currentStep: 'identity-and-address',
      steps: formDocument.data.attributes.steps,
      answers: {
        name: 'Ada Lovelace',
        dateOfBirth: '1815-12-10',
        country: 'United Kingdom',
        consentConfirmed: true,
        documentNumber: '',
      },
      documentEvidencePresent: true,
      version: 3,
    })
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
  })

  it.each([
    { applicationId: 'not-a-uuid', document: formDocument },
    {
      applicationId,
      document: {
        ...formDocument,
        data: {
          ...formDocument.data,
          id: '00000000-0000-4000-8000-999999999999',
        },
      },
    },
    {
      applicationId,
      document: {
        ...formDocument,
        data: {
          ...formDocument.data,
          attributes: {
            ...formDocument.data.attributes,
            answers: { unknownPrivateField: 'must not be accepted' },
          },
        },
      },
    },
    {
      applicationId,
      document: {
        ...formDocument,
        data: {
          ...formDocument.data,
          attributes: { ...formDocument.data.attributes, version: -1 },
        },
      },
    },
  ])('rejects malformed or mismatched form state', async (example) => {
    server.use(
      http.get(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        HttpResponse.json(example.document),
      ),
    )

    const error = await getApplicantForm(example.applicationId).catch(
      (cause: unknown) => cause,
    )
    expect(presentApplicantFormLoadError(error)).toEqual({
      authenticationRequired: false,
      message: 'The service returned an unexpected response. Try again.',
    })
  })

  it.each([
    {
      status: 401,
      expected: {
        authenticationRequired: true,
        message: 'Your session has expired. Sign in to continue.',
      },
    },
    {
      status: 404,
      expected: {
        authenticationRequired: false,
        message: 'This application is no longer available.',
      },
    },
    {
      status: 503,
      expected: {
        authenticationRequired: false,
        message: 'Your saved application could not be loaded. Try again.',
      },
    },
  ])('maps a $status response to safe recovery guidance', async (example) => {
    server.use(
      http.get(
        `/api/v1/applicant-applications/${applicationId}/form`,
        () => new HttpResponse(null, { status: example.status }),
      ),
    )
    const error = await getApplicantForm(applicationId).catch(
      (cause: unknown) => cause,
    )
    expect(presentApplicantFormLoadError(error)).toEqual(example.expected)
  })
})
