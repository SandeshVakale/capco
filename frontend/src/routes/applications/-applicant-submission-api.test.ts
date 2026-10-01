import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '../../test/server'

import {
  getApplicantSubmissionReceipt,
  presentApplicantSubmissionError,
  submitApplicantApplication,
} from './-applicant-submission-api'

const applicationId = '00000000-0000-4000-8000-000000000123'
const submissionDocument = {
  data: {
    type: 'applicant-applications',
    id: applicationId,
    attributes: {
      status: 'submitted',
      submittedAt: '2026-10-01T16:00:00Z',
      receipt: {
        message: 'Your application was received',
        nextStep: 'The review team will review your application.',
      },
    },
  },
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

describe('Applicant submission API', () => {
  it('submits explicit confirmation with the latest form version', async () => {
    document.cookie = 'XSRF-TOKEN=csrf%20token; Path=/'
    let capturedRequest: Request | undefined
    server.use(
      http.patch(
        `/api/v1/applicant-applications/${applicationId}`,
        ({ request }) => {
          capturedRequest = request
          return HttpResponse.json(submissionDocument)
        },
      ),
    )

    await expect(
      submitApplicantApplication({ applicationId, expectedFormVersion: 7 }),
    ).resolves.toEqual({
      message: 'Your application was received',
      nextStep: 'The review team will review your application.',
      submittedAt: '2026-10-01T16:00:00Z',
    })
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
        type: 'applicant-applications',
        id: applicationId,
        attributes: {
          status: 'submitted',
          confirmed: true,
          expectedFormVersion: 7,
        },
      },
    })
  })

  it('loads a committed receipt for direct visits and refreshes', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.get(
        `/api/v1/applicant-applications/${applicationId}`,
        ({ request }) => {
          capturedRequest = request
          return HttpResponse.json(submissionDocument)
        },
      ),
    )

    await expect(getApplicantSubmissionReceipt(applicationId)).resolves.toEqual(
      {
        message: 'Your application was received',
        nextStep: 'The review team will review your application.',
        submittedAt: '2026-10-01T16:00:00Z',
      },
    )
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
  })

  it('rejects an unverified or mismatched success response', async () => {
    server.use(
      http.patch(`/api/v1/applicant-applications/${applicationId}`, () =>
        HttpResponse.json({
          ...submissionDocument,
          data: { ...submissionDocument.data, id: crypto.randomUUID() },
        }),
      ),
    )

    const error = await submitApplicantApplication({
      applicationId,
      expectedFormVersion: 7,
    }).catch((cause: unknown) => cause)

    expect(presentApplicantSubmissionError(error).message).toBe(
      'The service returned an unexpected response. Try again.',
    )
  })

  it.each([
    {
      status: 401,
      body: undefined,
      message: 'Your session has expired. Sign in again before submitting.',
    },
    {
      status: 409,
      body: undefined,
      message: 'Your application changed before it could be submitted.',
    },
    {
      status: 422,
      body: {
        errors: [
          {
            detail:
              'Complete the required fields before submitting: documentEvidence.',
          },
        ],
      },
      message:
        'Complete the required fields before submitting: documentEvidence.',
    },
  ])('maps a submission $status to recovery guidance', async (example) => {
    server.use(
      http.patch(`/api/v1/applicant-applications/${applicationId}`, () =>
        example.body
          ? HttpResponse.json(example.body, { status: example.status })
          : new HttpResponse(null, { status: example.status }),
      ),
    )

    const error = await submitApplicantApplication({
      applicationId,
      expectedFormVersion: 7,
    }).catch((cause: unknown) => cause)

    expect(presentApplicantSubmissionError(error).message).toContain(
      example.message,
    )
  })
})
