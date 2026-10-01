import { File as NodeFile } from 'node:buffer'

import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  getApplicantForm,
  presentApplicantFormLoadError,
  presentApplicantFormSaveError,
  saveApplicantForm,
  uploadApplicantDocumentEvidence,
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

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

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

  it('saves only the selected step with the current version and CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf%20token; Path=/'
    let capturedRequest: Request | undefined
    server.use(
      http.patch(
        `/api/v1/applicant-applications/${applicationId}/form`,
        ({ request }) => {
          capturedRequest = request
          return HttpResponse.json({
            ...formDocument,
            data: {
              ...formDocument.data,
              attributes: { ...formDocument.data.attributes, version: 4 },
            },
          })
        },
      ),
    )

    await expect(
      saveApplicantForm({
        applicationId,
        step: 'personal-details',
        version: 3,
        answers: {
          name: 'Ada Lovelace',
          dateOfBirth: '1815-12-10',
          country: 'United Kingdom',
          nationality: 'British',
          email: 'ada@example.test',
          phone: '+44 20 0000 0000',
          consentConfirmed: true,
          documentNumber: 'must-not-cross-step-boundary',
        },
      }),
    ).resolves.toMatchObject({ version: 4 })

    expect(capturedRequest?.method).toBe('PATCH')
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    await expect(capturedRequest?.json()).resolves.toEqual({
      data: {
        type: 'applicant-application-forms',
        id: applicationId,
        attributes: {
          step: 'personal-details',
          answers: {
            name: 'Ada Lovelace',
            dateOfBirth: '1815-12-10',
            country: 'United Kingdom',
            nationality: 'British',
            email: 'ada@example.test',
            phone: '+44 20 0000 0000',
            consentConfirmed: true,
          },
          version: 3,
        },
      },
    })
  })

  it.each([
    {
      status: 401,
      body: undefined,
      expected: {
        authenticationRequired: true,
        conflict: false,
        message: 'Your session has expired. Sign in again before saving.',
      },
    },
    {
      status: 409,
      body: undefined,
      expected: {
        authenticationRequired: false,
        conflict: true,
        message:
          'This form changed in another session. Refresh its version, then save your edits again.',
      },
    },
    {
      status: 422,
      body: { errors: [{ detail: 'Enter a valid date of birth.' }] },
      expected: {
        authenticationRequired: false,
        conflict: false,
        message: 'Enter a valid date of birth.',
      },
    },
  ])('maps a save $status without losing safe API detail', async (example) => {
    server.use(
      http.patch(`/api/v1/applicant-applications/${applicationId}/form`, () =>
        example.body
          ? HttpResponse.json(example.body, { status: example.status })
          : new HttpResponse(null, { status: example.status }),
      ),
    )
    const error = await saveApplicantForm({
      applicationId,
      step: 'personal-details',
      answers: {},
      version: 3,
    }).catch((cause: unknown) => cause)

    expect(presentApplicantFormSaveError(error)).toEqual(example.expected)
  })

  it('makes clear that network failures did not discard entered answers', () => {
    expect(
      presentApplicantFormSaveError(new TypeError('Failed to fetch')),
    ).toEqual({
      authenticationRequired: false,
      conflict: false,
      message:
        'We could not connect to the service. Your answers are still here; try again.',
    })
  })

  it('uploads JPG or PNG evidence through authenticated multipart data', async () => {
    document.cookie = 'XSRF-TOKEN=csrf%20token; Path=/'
    let capturedRequest: Request | undefined
    server.use(
      http.post(
        `/api/v1/applicant-applications/${applicationId}/document-evidence`,
        ({ request }) => {
          capturedRequest = request
          return HttpResponse.json(
            {
              data: {
                type: 'applicant-application-document-evidence',
                id: applicationId,
                attributes: { present: true },
              },
            },
            { status: 201 },
          )
        },
      ),
    )
    const file = new NodeFile(['identity'], 'identity.png', {
      type: 'image/png',
    }) as unknown as File

    await expect(
      uploadApplicantDocumentEvidence({ applicationId, file }),
    ).resolves.toBeUndefined()

    expect(capturedRequest?.method).toBe('POST')
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('Content-Type')).toContain(
      'multipart/form-data; boundary=',
    )
    expect(capturedRequest?.headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    const body = await capturedRequest?.formData()
    expect(String(body?.get('file'))).toBe('[object File]')
  })

  it('rejects unsupported evidence before making a request', async () => {
    await expect(
      uploadApplicantDocumentEvidence({
        applicationId,
        file: new File(['pdf'], 'identity.pdf', {
          type: 'application/pdf',
        }),
      }),
    ).rejects.toThrow('Choose a JPG or PNG identity document.')
  })
})
