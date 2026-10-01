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
  constructor(readonly status: number) {
    super('Applicant form request failed')
    this.name = 'ApplicantFormHttpError'
  }
}

export class ApplicantFormContractError extends Error {
  constructor() {
    super('Applicant form response did not match the API contract')
    this.name = 'ApplicantFormContractError'
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
