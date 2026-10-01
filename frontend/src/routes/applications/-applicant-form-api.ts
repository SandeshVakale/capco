import type { ApplicantApplicationStep } from './-applicant-application-api'

const jsonApiMediaType = 'application/vnd.api+json'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const answerNames = [
  'name',
  'dateOfBirth',
  'country',
  'nationality',
  'email',
  'phone',
  'consentConfirmed',
  'documentType',
  'documentNumber',
  'documentCountry',
  'expiry',
  'street',
  'city',
  'postal',
  'residentialCountry',
] as const

export type ApplicantFormAnswerName = (typeof answerNames)[number]
type TextAnswerName = Exclude<ApplicantFormAnswerName, 'consentConfirmed'>
export type ApplicantFormAnswers = Partial<Record<TextAnswerName, string>> & {
  consentConfirmed?: boolean
}

export interface ApplicantForm {
  id: string
  currentStep: ApplicantApplicationStep
  steps: Array<{
    step: ApplicantApplicationStep
    state: 'current' | 'complete' | 'remaining'
  }>
  answers: ApplicantFormAnswers
  documentEvidencePresent: boolean
  version: number
}

export class ApplicantFormHttpError extends Error {
  constructor(
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super('Applicant form request failed')
    this.name = 'ApplicantFormHttpError'
  }
}

const stepAnswerNames: Record<
  ApplicantApplicationStep,
  readonly ApplicantFormAnswerName[]
> = {
  'personal-details': [
    'name',
    'dateOfBirth',
    'country',
    'nationality',
    'email',
    'phone',
    'consentConfirmed',
  ],
  'identity-and-address': [
    'documentType',
    'documentNumber',
    'documentCountry',
    'expiry',
    'street',
    'city',
    'postal',
    'residentialCountry',
  ],
}

export class ApplicantFormContractError extends Error {
  constructor() {
    super('Applicant form response did not match the API contract')
    this.name = 'ApplicantFormContractError'
  }
}

export class ApplicantDocumentEvidenceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApplicantDocumentEvidenceValidationError'
  }
}

function isStep(value: unknown): value is ApplicantApplicationStep {
  return value === 'personal-details' || value === 'identity-and-address'
}

function parseAnswers(value: unknown): ApplicantFormAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApplicantFormContractError()
  }
  const answers: ApplicantFormAnswers = {}
  for (const [name, answer] of Object.entries(value)) {
    if (!answerNames.includes(name as ApplicantFormAnswerName)) {
      throw new ApplicantFormContractError()
    }
    if (name === 'consentConfirmed') {
      if (typeof answer !== 'boolean') throw new ApplicantFormContractError()
      answers.consentConfirmed = answer
    } else {
      if (answer !== null && typeof answer !== 'string') {
        throw new ApplicantFormContractError()
      }
      answers[name as TextAnswerName] = answer ?? ''
    }
  }
  return answers
}

function parseForm(document: unknown, expectedId: string): ApplicantForm {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('data' in document) ||
    typeof document.data !== 'object' ||
    document.data === null
  )
    throw new ApplicantFormContractError()

  const data = document.data
  if (
    !('type' in data) ||
    data.type !== 'applicant-application-forms' ||
    !('id' in data) ||
    data.id !== expectedId ||
    !('attributes' in data) ||
    typeof data.attributes !== 'object' ||
    data.attributes === null
  )
    throw new ApplicantFormContractError()

  const attributes = data.attributes
  if (
    !('status' in attributes) ||
    attributes.status !== 'draft' ||
    !('currentStep' in attributes) ||
    !isStep(attributes.currentStep) ||
    !('steps' in attributes) ||
    !Array.isArray(attributes.steps) ||
    !('answers' in attributes) ||
    !('documentEvidence' in attributes) ||
    typeof attributes.documentEvidence !== 'object' ||
    attributes.documentEvidence === null ||
    !('present' in attributes.documentEvidence) ||
    typeof attributes.documentEvidence.present !== 'boolean' ||
    !('version' in attributes) ||
    !Number.isInteger(attributes.version) ||
    (attributes.version as number) < 0
  )
    throw new ApplicantFormContractError()

  const steps = attributes.steps.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('step' in item) ||
      !isStep(item.step) ||
      !('state' in item) ||
      (item.state !== 'current' &&
        item.state !== 'complete' &&
        item.state !== 'remaining')
    )
      throw new ApplicantFormContractError()
    return { step: item.step, state: item.state }
  })
  if (steps.length !== 2 || new Set(steps.map(({ step }) => step)).size !== 2) {
    throw new ApplicantFormContractError()
  }

  return {
    id: expectedId,
    currentStep: attributes.currentStep,
    steps,
    answers: parseAnswers(attributes.answers),
    documentEvidencePresent: attributes.documentEvidence.present,
    version: attributes.version as number,
  }
}

export async function getApplicantForm(
  applicationId: string,
): Promise<ApplicantForm> {
  if (!uuidPattern.test(applicationId)) throw new ApplicantFormContractError()
  const response = await fetch(
    `/api/v1/applicant-applications/${applicationId}/form`,
    {
      credentials: 'same-origin',
      headers: { Accept: jsonApiMediaType },
    },
  )
  if (response.status !== 200) throw new ApplicantFormHttpError(response.status)
  try {
    return parseForm(await response.json(), applicationId)
  } catch (error) {
    if (error instanceof ApplicantFormContractError) throw error
    throw new ApplicantFormContractError()
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

function answersForStep(
  step: ApplicantApplicationStep,
  answers: ApplicantFormAnswers,
): ApplicantFormAnswers {
  return Object.fromEntries(
    stepAnswerNames[step].map((name) => [
      name,
      name === 'consentConfirmed'
        ? (answers.consentConfirmed ?? false)
        : (answers[name] ?? ''),
    ]),
  ) as ApplicantFormAnswers
}

export async function saveApplicantForm({
  applicationId,
  step,
  answers,
  version,
}: {
  applicationId: string
  step: ApplicantApplicationStep
  answers: ApplicantFormAnswers
  version: number
}): Promise<ApplicantForm> {
  if (
    !uuidPattern.test(applicationId) ||
    !Number.isInteger(version) ||
    version < 0
  ) {
    throw new ApplicantFormContractError()
  }
  const token = csrfToken()
  const response = await fetch(
    `/api/v1/applicant-applications/${applicationId}/form`,
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
          type: 'applicant-application-forms',
          id: applicationId,
          attributes: {
            step,
            answers: answersForStep(step, answers),
            version,
          },
        },
      }),
    },
  )
  if (response.status !== 200) {
    throw new ApplicantFormHttpError(
      response.status,
      await readErrorDetails(response),
    )
  }
  try {
    return parseForm(await response.json(), applicationId)
  } catch (error) {
    if (error instanceof ApplicantFormContractError) throw error
    throw new ApplicantFormContractError()
  }
}

export async function uploadApplicantDocumentEvidence({
  applicationId,
  file,
}: {
  applicationId: string
  file: File
}): Promise<void> {
  if (!uuidPattern.test(applicationId)) throw new ApplicantFormContractError()
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    throw new ApplicantDocumentEvidenceValidationError(
      'Choose a JPG or PNG identity document.',
    )
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ApplicantDocumentEvidenceValidationError(
      'Choose an identity document smaller than 10 MiB.',
    )
  }
  const token = csrfToken()
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(
    `/api/v1/applicant-applications/${applicationId}/document-evidence`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: jsonApiMediaType,
        ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
      },
      body,
    },
  )
  if (response.status !== 201) {
    throw new ApplicantFormHttpError(
      response.status,
      await readErrorDetails(response),
    )
  }
  try {
    const document = (await response.json()) as {
      data?: {
        type?: unknown
        id?: unknown
        attributes?: { present?: unknown }
      }
    }
    if (
      document.data?.type !== 'applicant-application-document-evidence' ||
      document.data.id !== applicationId ||
      document.data.attributes?.present !== true
    ) {
      throw new ApplicantFormContractError()
    }
  } catch (error) {
    if (error instanceof ApplicantFormContractError) throw error
    throw new ApplicantFormContractError()
  }
}

export function presentApplicantDocumentEvidenceError(error: unknown): string {
  if (error instanceof ApplicantDocumentEvidenceValidationError) {
    return error.message
  }
  if (error instanceof ApplicantFormHttpError && error.status === 401) {
    return 'Your session has expired. Sign in again before uploading.'
  }
  if (
    error instanceof ApplicantFormHttpError &&
    (error.status === 415 || error.status === 422)
  ) {
    return (
      error.details[0] ?? 'The document could not be accepted. Choose another.'
    )
  }
  if (error instanceof ApplicantFormContractError) {
    return 'The service returned an unexpected response. Try again.'
  }
  if (error instanceof ApplicantFormHttpError) {
    return 'Your document could not be uploaded. Try again.'
  }
  return 'We could not connect to the service. Try again.'
}

export interface ApplicantFormSaveErrorPresentation {
  authenticationRequired: boolean
  conflict: boolean
  message: string
}

export function presentApplicantFormSaveError(
  error: unknown,
): ApplicantFormSaveErrorPresentation {
  if (error instanceof ApplicantFormHttpError && error.status === 401) {
    return {
      authenticationRequired: true,
      conflict: false,
      message: 'Your session has expired. Sign in again before saving.',
    }
  }
  if (error instanceof ApplicantFormHttpError && error.status === 409) {
    return {
      authenticationRequired: false,
      conflict: true,
      message:
        'This form changed in another session. Refresh its version, then save your edits again.',
    }
  }
  if (
    error instanceof ApplicantFormHttpError &&
    (error.status === 400 || error.status === 422)
  ) {
    return {
      authenticationRequired: false,
      conflict: false,
      message:
        error.details[0] ??
        'Some answers could not be saved. Check them and try again.',
    }
  }
  if (error instanceof ApplicantFormHttpError && error.status === 404) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'This application is no longer available.',
    }
  }
  if (error instanceof ApplicantFormContractError) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'The service returned an unexpected response. Try again.',
    }
  }
  if (error instanceof ApplicantFormHttpError) {
    return {
      authenticationRequired: false,
      conflict: false,
      message: 'Your answers could not be saved. Try again.',
    }
  }
  return {
    authenticationRequired: false,
    conflict: false,
    message:
      'We could not connect to the service. Your answers are still here; try again.',
  }
}

export function presentApplicantFormLoadError(error: unknown): {
  authenticationRequired: boolean
  message: string
} {
  if (error instanceof ApplicantFormHttpError && error.status === 401) {
    return {
      authenticationRequired: true,
      message: 'Your session has expired. Sign in to continue.',
    }
  }
  if (error instanceof ApplicantFormHttpError && error.status === 404) {
    return {
      authenticationRequired: false,
      message: 'This application is no longer available.',
    }
  }
  if (error instanceof ApplicantFormContractError) {
    return {
      authenticationRequired: false,
      message: 'The service returned an unexpected response. Try again.',
    }
  }
  if (error instanceof ApplicantFormHttpError) {
    return {
      authenticationRequired: false,
      message: 'Your saved application could not be loaded. Try again.',
    }
  }
  return {
    authenticationRequired: false,
    message:
      'We could not connect to the service. Check your connection and try again.',
  }
}
