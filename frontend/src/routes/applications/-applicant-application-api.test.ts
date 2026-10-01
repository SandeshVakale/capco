import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  createCurrentApplicantApplication,
  getCurrentApplicantApplication,
  presentApplicantApplicationError,
} from './-applicant-application-api'

const applicationId = '00000000-0000-4000-8000-000000000123'
const applicationDocument = {
  data: {
    type: 'applicant-applications',
    id: applicationId,
    attributes: {
      status: 'draft',
      currentStep: 'identity-and-address',
      href: `/applications/${applicationId}/identity-and-address`,
      progress: [
        { step: 'personal-details', state: 'complete' },
        { step: 'identity-and-address', state: 'current' },
      ],
    },
  },
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

describe('current Applicant application API', () => {
  it('loads and parses the signed-in Applicant draft', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.get('/api/v1/applicant-applications/current', ({ request }) => {
        capturedRequest = request
        return HttpResponse.json(applicationDocument)
      }),
    )

    await expect(getCurrentApplicantApplication()).resolves.toEqual({
      id: applicationId,
      currentStep: 'identity-and-address',
      href: `/applications/${applicationId}/identity-and-address`,
      progress: applicationDocument.data.attributes.progress,
    })
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
  })

  it('represents a missing current draft without creating one', async () => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(getCurrentApplicantApplication()).resolves.toBeNull()
  })

  it('starts a draft with the session cookie and decoded CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf%20token; Path=/'
    let capturedRequest: Request | undefined
    server.use(
      http.post('/api/v1/applicant-applications', ({ request }) => {
        capturedRequest = request
        return HttpResponse.json(applicationDocument, { status: 201 })
      }),
    )

    await expect(createCurrentApplicantApplication()).resolves.toMatchObject({
      id: applicationId,
      currentStep: 'identity-and-address',
    })
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    expect(await capturedRequest?.text()).toBe('')
  })

  it.each([
    {
      document: {
        ...applicationDocument,
        data: { ...applicationDocument.data, type: 'unexpected' },
      },
    },
    {
      document: {
        ...applicationDocument,
        data: {
          ...applicationDocument.data,
          attributes: {
            ...applicationDocument.data.attributes,
            href: 'https://attacker.example/applications/current',
          },
        },
      },
    },
    {
      document: {
        ...applicationDocument,
        data: {
          ...applicationDocument.data,
          attributes: {
            ...applicationDocument.data.attributes,
            progress: [
              { step: 'personal-details', state: 'current' },
              { step: 'personal-details', state: 'complete' },
            ],
          },
        },
      },
    },
  ])('rejects a malformed application response', async ({ document }) => {
    server.use(
      http.get('/api/v1/applicant-applications/current', () =>
        HttpResponse.json(document),
      ),
    )

    const error = await getCurrentApplicantApplication().catch(
      (cause: unknown) => cause,
    )
    expect(presentApplicantApplicationError(error)).toEqual({
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
      status: 503,
      expected: {
        authenticationRequired: false,
        message: 'Your application could not be loaded. Try again.',
      },
    },
  ])('maps a $status response to actionable feedback', async (example) => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: example.status }),
      ),
    )

    const error = await getCurrentApplicantApplication().catch(
      (cause: unknown) => cause,
    )
    expect(presentApplicantApplicationError(error)).toEqual(example.expected)
  })

  it('maps network failures without exposing implementation details', () => {
    expect(
      presentApplicantApplicationError(new TypeError('Failed to fetch')),
    ).toEqual({
      authenticationRequired: false,
      message:
        'We could not connect to the service. Check your connection and try again.',
    })
  })
})
