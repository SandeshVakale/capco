import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'

import {
  presentRegistrationError,
  registerApplicantAccount,
} from './-applicant-registration-api'

describe('applicant registration API', () => {
  it('creates an account using the documented JSON:API contract', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.post('/api/v1/applicant-accounts', ({ request }) => {
        capturedRequest = request
        return new HttpResponse(null, { status: 201 })
      }),
    )

    await registerApplicantAccount({
      email: 'applicant@example.com',
      password: 'Secure!1',
    })

    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    await expect(capturedRequest?.json()).resolves.toEqual({
      data: {
        type: 'applicant-accounts',
        attributes: {
          email: 'applicant@example.com',
          password: 'Secure!1',
        },
      },
    })
  })

  it('maps API validation errors to their fields', async () => {
    server.use(
      http.post('/api/v1/applicant-accounts', () =>
        HttpResponse.json(
          {
            errors: [
              {
                detail: 'Enter a valid email address.',
                source: { pointer: '/data/attributes/email' },
              },
              {
                detail: 'Use a stronger password.',
                source: { pointer: '/data/attributes/password' },
              },
            ],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await registerApplicantAccount({
      email: 'applicant@example.com',
      password: 'Secure!1',
    }).catch((cause: unknown) => cause)

    expect(presentRegistrationError(error)).toEqual({
      message: 'Check the highlighted fields and try again.',
      fieldErrors: {
        email: 'Enter a valid email address.',
        password: 'Use a stronger password.',
      },
    })
  })

  it('uses safe API detail for a malformed request response', async () => {
    server.use(
      http.post('/api/v1/applicant-accounts', () =>
        HttpResponse.json(
          {
            errors: [
              {
                detail: 'The request body is not a valid JSON:API document.',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await registerApplicantAccount({
      email: 'applicant@example.com',
      password: 'Secure!1',
    }).catch((cause: unknown) => cause)

    expect(presentRegistrationError(error).message).toBe(
      'The request body is not a valid JSON:API document.',
    )
  })

  it.each([
    {
      status: 409,
      headers: undefined,
      expected:
        'An account already exists for this email address. Sign in or use another email address.',
    },
    {
      status: 429,
      headers: { 'Retry-After': '30' },
      expected: 'Too many attempts. Try again in 30 seconds.',
    },
    {
      status: 500,
      headers: undefined,
      expected: 'We could not create your account. Try again.',
    },
  ])('maps a $status response to useful feedback', async (example) => {
    server.use(
      http.post(
        '/api/v1/applicant-accounts',
        () =>
          new HttpResponse(null, {
            status: example.status,
            headers: example.headers,
          }),
      ),
    )

    const error = await registerApplicantAccount({
      email: 'applicant@example.com',
      password: 'Secure!1',
    }).catch((cause: unknown) => cause)

    expect(presentRegistrationError(error).message).toBe(example.expected)
  })

  it('maps network failures without exposing implementation details', () => {
    expect(presentRegistrationError(new TypeError('Failed to fetch'))).toEqual({
      message:
        'We could not connect to the service. Check your connection and try again.',
    })
  })
})
