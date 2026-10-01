import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'

import {
  createApplicantSession,
  presentSignInError,
} from './-applicant-session-api'

const credentials = {
  email: 'applicant@example.com',
  password: 'Secure!1',
}

describe('applicant session API', () => {
  it('creates a cookie-compatible session using the JSON:API contract', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.post('/api/v1/applicant-sessions', ({ request }) => {
        capturedRequest = request
        return HttpResponse.json(
          {
            data: {
              type: 'applicant-sessions',
              id: '00000000-0000-4000-8000-000000000123',
              attributes: { href: '/applications/current' },
            },
          },
          { status: 201 },
        )
      }),
    )

    await expect(createApplicantSession(credentials)).resolves.toEqual({
      href: '/applications/current',
    })
    expect(capturedRequest?.credentials).toBe('same-origin')
    expect(capturedRequest?.headers.get('Accept')).toBe(
      'application/vnd.api+json',
    )
    expect(capturedRequest?.headers.get('Content-Type')).toBe(
      'application/vnd.api+json',
    )
    await expect(capturedRequest?.json()).resolves.toEqual({
      data: {
        type: 'applicant-sessions',
        attributes: credentials,
      },
    })
  })

  it.each([
    { href: 'https://attacker.example/applications/current' },
    { href: '//attacker.example/applications/current' },
    { href: '/reviewer/applications' },
    { href: 42 },
  ])('rejects an unsafe or malformed journey href: $href', async ({ href }) => {
    server.use(
      http.post('/api/v1/applicant-sessions', () =>
        HttpResponse.json(
          {
            data: {
              type: 'applicant-sessions',
              id: '00000000-0000-4000-8000-000000000123',
              attributes: { href },
            },
          },
          { status: 201 },
        ),
      ),
    )

    const error = await createApplicantSession(credentials).catch(
      (cause: unknown) => cause,
    )
    expect(presentSignInError(error)).toEqual({
      message: 'The service returned an unexpected response. Try again.',
    })
  })

  it('maps API validation errors to their fields', async () => {
    server.use(
      http.post('/api/v1/applicant-sessions', () =>
        HttpResponse.json(
          {
            errors: [
              {
                detail: 'Enter a valid email address.',
                source: { pointer: '/data/attributes/email' },
              },
              {
                detail: 'Password is too short.',
                source: { pointer: '/data/attributes/password' },
              },
            ],
          },
          { status: 400 },
        ),
      ),
    )

    const error = await createApplicantSession(credentials).catch(
      (cause: unknown) => cause,
    )
    expect(presentSignInError(error)).toEqual({
      message: 'Check the highlighted fields and try again.',
      fieldErrors: {
        email: 'Enter a valid email address.',
        password: 'Password is too short.',
      },
    })
  })

  it('uses safe API detail for a malformed request response', async () => {
    server.use(
      http.post('/api/v1/applicant-sessions', () =>
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

    const error = await createApplicantSession(credentials).catch(
      (cause: unknown) => cause,
    )
    expect(presentSignInError(error).message).toBe(
      'The request body is not a valid JSON:API document.',
    )
  })

  it('never exposes account existence in invalid-credential feedback', async () => {
    server.use(
      http.post('/api/v1/applicant-sessions', () =>
        HttpResponse.json(
          {
            errors: [
              {
                detail: 'No account exists for this email address.',
              },
            ],
          },
          { status: 401 },
        ),
      ),
    )

    const error = await createApplicantSession(credentials).catch(
      (cause: unknown) => cause,
    )
    expect(presentSignInError(error)).toEqual({
      message: 'Invalid email or password.',
    })
  })

  it.each([
    {
      status: 429,
      headers: { 'Retry-After': '20' },
      expected: 'Too many attempts. Try again in 20 seconds.',
    },
    {
      status: 500,
      headers: undefined,
      expected: 'We could not sign you in. Try again.',
    },
  ])('maps a $status response to safe feedback', async (example) => {
    server.use(
      http.post(
        '/api/v1/applicant-sessions',
        () =>
          new HttpResponse(null, {
            status: example.status,
            headers: example.headers,
          }),
      ),
    )

    const error = await createApplicantSession(credentials).catch(
      (cause: unknown) => cause,
    )
    expect(presentSignInError(error).message).toBe(example.expected)
  })

  it('maps network failures without exposing implementation details', () => {
    expect(presentSignInError(new TypeError('Failed to fetch'))).toEqual({
      message:
        'We could not connect to the service. Check your connection and try again.',
    })
  })
})
