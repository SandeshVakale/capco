const jsonApiMediaType = 'application/vnd.api+json'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ApplicantSubmissionReceipt {
  message: string
  nextStep: string
  submittedAt: string
}

export class ApplicantSubmissionHttpError extends Error {
  constructor(
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super('Applicant submission request failed')
    this.name = 'ApplicantSubmissionHttpError'
  }
}

export class ApplicantSubmissionContractError extends Error {
  constructor() {
    super('Applicant submission response did not match the API contract')
    this.name = 'ApplicantSubmissionContractError'
  }
}

function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)
}

async function readErrorDetails(response: Response): Promise<string[]> {
  try {
    const document = (await response.json()) as { errors?: unknown }
    if (!Array.isArray(document.errors)) return []
    return document.errors.flatMap((error) =>
      typeof error === 'object' &&
      error !== null &&
      'detail' in error &&
      typeof error.detail === 'string'
        ? [error.detail]
        : [],
    )
  } catch {
    return []
  }
}

function parseSubmission(
  document: unknown,
  applicationId: string,
): ApplicantSubmissionReceipt {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('data' in document) ||
    typeof document.data !== 'object' ||
    document.data === null
  ) {
    throw new ApplicantSubmissionContractError()
  }
  const data = document.data
  if (
    !('type' in data) ||
    data.type !== 'applicant-applications' ||
    !('id' in data) ||
    data.id !== applicationId ||
    !('attributes' in data) ||
    typeof data.attributes !== 'object' ||
    data.attributes === null
  ) {
    throw new ApplicantSubmissionContractError()
  }
  const attributes = data.attributes
  if (
    !('status' in attributes) ||
    attributes.status !== 'submitted' ||
    !('submittedAt' in attributes) ||
    typeof attributes.submittedAt !== 'string' ||
    Number.isNaN(Date.parse(attributes.submittedAt)) ||
    !('receipt' in attributes) ||
    typeof attributes.receipt !== 'object' ||
    attributes.receipt === null ||
    !('message' in attributes.receipt) ||
    typeof attributes.receipt.message !== 'string' ||
    !('nextStep' in attributes.receipt) ||
    typeof attributes.receipt.nextStep !== 'string'
  ) {
    throw new ApplicantSubmissionContractError()
  }
  return {
    message: attributes.receipt.message,
    nextStep: attributes.receipt.nextStep,
    submittedAt: attributes.submittedAt,
  }
}

export async function submitApplicantApplication({
  applicationId,
  expectedFormVersion,
}: {
  applicationId: string
  expectedFormVersion: number
}): Promise<ApplicantSubmissionReceipt> {
  if (
    !uuidPattern.test(applicationId) ||
    !Number.isInteger(expectedFormVersion) ||
    expectedFormVersion < 0
  ) {
    throw new ApplicantSubmissionContractError()
  }
  const token = csrfToken()
  const response = await fetch(
    `/api/v1/applicant-applications/${applicationId}`,
    {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        Accept: jsonApiMediaType,
        'Content-Type': jsonApiMediaType,
        ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
      },
      body: JSON.stringify({
        data: {
          type: 'applicant-applications',
          id: applicationId,
          attributes: {
            status: 'submitted',
            confirmed: true,
            expectedFormVersion,
          },
        },
      }),
    },
  )
  if (response.status !== 200) {
    throw new ApplicantSubmissionHttpError(
      response.status,
      await readErrorDetails(response),
    )
  }
  try {
    return parseSubmission(await response.json(), applicationId)
  } catch (error) {
    if (error instanceof ApplicantSubmissionContractError) throw error
    throw new ApplicantSubmissionContractError()
  }
}

export async function getApplicantSubmissionReceipt(
  applicationId: string,
): Promise<ApplicantSubmissionReceipt> {
  if (!uuidPattern.test(applicationId)) {
    throw new ApplicantSubmissionContractError()
  }
  const response = await fetch(
    `/api/v1/applicant-applications/${applicationId}`,
    {
      credentials: 'same-origin',
      headers: { Accept: jsonApiMediaType },
    },
  )
  if (response.status !== 200) {
    throw new ApplicantSubmissionHttpError(
      response.status,
      await readErrorDetails(response),
    )
  }
  try {
    return parseSubmission(await response.json(), applicationId)
  } catch (error) {
    if (error instanceof ApplicantSubmissionContractError) throw error
    throw new ApplicantSubmissionContractError()
  }
}

export interface ApplicantSubmissionErrorPresentation {
  authenticationRequired: boolean
  conflict: boolean
  message: string
}

export function presentApplicantSubmissionError(
  error: unknown,
): ApplicantSubmissionErrorPresentation {
  if (error instanceof ApplicantSubmissionHttpError && error.status === 401) {
    return {
      authenticationRequired: true,
      conflict: false,
      message: 'Your session has expired. Sign in again before submitting.',
    }
  }
  if (error instanceof ApplicantSubmissionHttpError && error.status === 409) {
    return {
      authenticationRequired: false,
      conflict: true,
      message:
        'Your application changed before it could be submitted. Return to the form, review the latest answers, and try again.',
    }
  }
  if (error instanceof ApplicantSubmissionHttpError && error.status === 422) {
    return {
      authenticationRequired: false,
      conflict: false,
      message:
        error.details[0] ??
        'Your application is incomplete. Return to the form and check the required fields.',
    }
  }
  if (error instanceof ApplicantSubmissionHttpError && error.status === 404) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'This application is no longer available.',
    }
  }
  if (error instanceof ApplicantSubmissionContractError) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'The service returned an unexpected response. Try again.',
    }
  }
  if (error instanceof ApplicantSubmissionHttpError) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'Your application could not be submitted. Try again.',
    }
  }
  return {
    authenticationRequired: false,
    conflict: false,
    message: 'We could not connect to the service. Try again.',
  }
}
