import { isSafeJourneyPath } from './-return-target'

const jsonApiMediaType = 'application/vnd.api+json'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ApplicantCredentials {
  email: string
  password: string
}

export interface ApplicantSession {
  href: string
}

interface JsonApiError {
  detail?: unknown
  source?: { pointer?: unknown }
}

interface JsonApiErrorDocument {
  errors?: unknown
}

export interface SignInSubmissionError {
  message: string
  fieldErrors?: {
    email?: string
    password?: string
  }
}

export class ApplicantSessionHttpError extends Error {
  constructor(
    readonly status: number,
    readonly errors: JsonApiError[],
    readonly retryAfterSeconds?: number,
  ) {
    super('Applicant sign-in failed')
    this.name = 'ApplicantSessionHttpError'
  }
}

export class ApplicantSessionContractError extends Error {
  constructor() {
    super('Applicant session response did not match the API contract')
    this.name = 'ApplicantSessionContractError'
  }
}

function isJsonApiError(value: unknown): value is JsonApiError {
  return typeof value === 'object' && value !== null
}

async function readErrors(response: Response): Promise<JsonApiError[]> {
  try {
    const document = (await response.json()) as JsonApiErrorDocument
    return Array.isArray(document.errors)
      ? document.errors.filter(isJsonApiError)
      : []
  } catch {
    return []
  }
}

function readRetryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get('Retry-After'))
  return Number.isInteger(value) && value > 0 ? value : undefined
}

function parseSession(document: unknown): ApplicantSession {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('data' in document)
  ) {
    throw new ApplicantSessionContractError()
  }
  const data = document.data
  if (
    typeof data !== 'object' ||
    data === null ||
    !('type' in data) ||
    data.type !== 'applicant-sessions' ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !uuidPattern.test(data.id) ||
    !('attributes' in data) ||
    typeof data.attributes !== 'object' ||
    data.attributes === null ||
    !('href' in data.attributes) ||
    typeof data.attributes.href !== 'string' ||
    !isSafeJourneyPath(data.attributes.href)
  ) {
    throw new ApplicantSessionContractError()
  }
  return { href: data.attributes.href }
}

export async function createApplicantSession({
  email,
  password,
}: ApplicantCredentials): Promise<ApplicantSession> {
  const response = await fetch('/api/v1/applicant-sessions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: jsonApiMediaType,
      'Content-Type': jsonApiMediaType,
    },
    body: JSON.stringify({
      data: {
        type: 'applicant-sessions',
        attributes: { email, password },
      },
    }),
  })

  if (response.status === 201) {
    try {
      return parseSession(await response.json())
    } catch (error) {
      if (error instanceof ApplicantSessionContractError) throw error
      throw new ApplicantSessionContractError()
    }
  }

  throw new ApplicantSessionHttpError(
    response.status,
    await readErrors(response),
    readRetryAfter(response),
  )
}

function errorDetail(error: JsonApiError): string | undefined {
  return typeof error.detail === 'string' ? error.detail : undefined
}

export function presentSignInError(error: unknown): SignInSubmissionError {
  if (error instanceof ApplicantSessionContractError) {
    return {
      message: 'The service returned an unexpected response. Try again.',
    }
  }

  if (!(error instanceof ApplicantSessionHttpError)) {
    return {
      message:
        'We could not connect to the service. Check your connection and try again.',
    }
  }

  if (error.status === 400) {
    const fieldErrors: SignInSubmissionError['fieldErrors'] = {}
    for (const item of error.errors) {
      const detail = errorDetail(item)
      if (!detail) continue
      if (item.source?.pointer === '/data/attributes/email') {
        fieldErrors.email ??= detail
      }
      if (item.source?.pointer === '/data/attributes/password') {
        fieldErrors.password ??= detail
      }
    }
    if (fieldErrors.email || fieldErrors.password) {
      return {
        message: 'Check the highlighted fields and try again.',
        fieldErrors,
      }
    }
    return {
      message:
        error.errors.map(errorDetail).find(Boolean) ??
        'Some sign-in details were not accepted. Check them and try again.',
    }
  }

  if (error.status === 401) {
    return { message: 'Invalid email or password.' }
  }

  if (error.status === 429) {
    return {
      message: error.retryAfterSeconds
        ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`
        : 'Too many attempts. Try again later.',
    }
  }

  return { message: 'We could not sign you in. Try again.' }
}
