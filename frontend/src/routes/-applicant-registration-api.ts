const jsonApiMediaType = 'application/vnd.api+json'

export interface ApplicantCredentials {
  email: string
  password: string
}

interface JsonApiError {
  detail?: unknown
  source?: { pointer?: unknown }
}

interface JsonApiErrorDocument {
  errors?: unknown
}

export interface RegistrationSubmissionError {
  message: string
  fieldErrors?: {
    email?: string
    password?: string
  }
}

export class ApplicantRegistrationError extends Error {
  constructor(
    readonly status: number,
    readonly errors: JsonApiError[],
    readonly retryAfterSeconds?: number,
  ) {
    super('Applicant registration failed')
    this.name = 'ApplicantRegistrationError'
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

export async function registerApplicantAccount({
  email,
  password,
}: ApplicantCredentials): Promise<void> {
  const response = await fetch('/api/v1/applicant-accounts', {
    method: 'POST',
    headers: {
      Accept: jsonApiMediaType,
      'Content-Type': jsonApiMediaType,
    },
    body: JSON.stringify({
      data: {
        type: 'applicant-accounts',
        attributes: { email, password },
      },
    }),
  })

  if (response.status === 201) return

  throw new ApplicantRegistrationError(
    response.status,
    await readErrors(response),
    readRetryAfter(response),
  )
}

function errorDetail(error: JsonApiError): string | undefined {
  return typeof error.detail === 'string' ? error.detail : undefined
}

export function presentRegistrationError(
  error: unknown,
): RegistrationSubmissionError {
  if (!(error instanceof ApplicantRegistrationError)) {
    return {
      message:
        'We could not connect to the service. Check your connection and try again.',
    }
  }

  if (error.status === 400) {
    const fieldErrors: RegistrationSubmissionError['fieldErrors'] = {}
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
        'Some account details were not accepted. Check them and try again.',
    }
  }

  if (error.status === 409) {
    return {
      message:
        'An account already exists for this email address. Sign in or use another email address.',
    }
  }

  if (error.status === 429) {
    return {
      message: error.retryAfterSeconds
        ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`
        : 'Too many attempts. Try again later.',
    }
  }

  return {
    message: 'We could not create your account. Try again.',
  }
}
