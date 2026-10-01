const jsonApiMediaType = 'application/vnd.api+json'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ApplicantApplicationStep =
  'personal-details' | 'identity-and-address'
export type ApplicantApplicationStepState =
  'not-started' | 'current' | 'complete'

export interface ApplicantApplication {
  id: string
  currentStep: ApplicantApplicationStep
  href: string
  progress: Array<{
    step: ApplicantApplicationStep
    state: ApplicantApplicationStepState
  }>
}

export class ApplicantApplicationHttpError extends Error {
  constructor(readonly status: number) {
    super('Applicant application request failed')
    this.name = 'ApplicantApplicationHttpError'
  }
}

export class ApplicantApplicationContractError extends Error {
  constructor() {
    super('Applicant application response did not match the API contract')
    this.name = 'ApplicantApplicationContractError'
  }
}

function isStep(value: unknown): value is ApplicantApplicationStep {
  return value === 'personal-details' || value === 'identity-and-address'
}

function isStepState(value: unknown): value is ApplicantApplicationStepState {
  return value === 'not-started' || value === 'current' || value === 'complete'
}

function parseApplication(document: unknown): ApplicantApplication {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('data' in document) ||
    typeof document.data !== 'object' ||
    document.data === null
  ) {
    throw new ApplicantApplicationContractError()
  }
  const data = document.data
  if (
    !('type' in data) ||
    data.type !== 'applicant-applications' ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !uuidPattern.test(data.id) ||
    !('attributes' in data) ||
    typeof data.attributes !== 'object' ||
    data.attributes === null
  ) {
    throw new ApplicantApplicationContractError()
  }
  const attributes = data.attributes
  if (
    !('status' in attributes) ||
    attributes.status !== 'draft' ||
    !('currentStep' in attributes) ||
    !isStep(attributes.currentStep) ||
    !('href' in attributes) ||
    typeof attributes.href !== 'string' ||
    attributes.href !== `/applications/${data.id}/${attributes.currentStep}` ||
    !('progress' in attributes) ||
    !Array.isArray(attributes.progress)
  ) {
    throw new ApplicantApplicationContractError()
  }

  const progress = attributes.progress.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('step' in item) ||
      !isStep(item.step) ||
      !('state' in item) ||
      !isStepState(item.state)
    ) {
      throw new ApplicantApplicationContractError()
    }
    return { step: item.step, state: item.state }
  })
  if (
    progress.length !== 2 ||
    new Set(progress.map(({ step }) => step)).size !== 2
  ) {
    throw new ApplicantApplicationContractError()
  }

  return {
    id: data.id,
    currentStep: attributes.currentStep,
    href: attributes.href,
    progress,
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

export async function getCurrentApplicantApplication(): Promise<ApplicantApplication | null> {
  const response = await fetch('/api/v1/applicant-applications/current', {
    credentials: 'same-origin',
    headers: { Accept: jsonApiMediaType },
  })
  if (response.status === 204) return null
  if (response.status !== 200) {
    throw new ApplicantApplicationHttpError(response.status)
  }
  try {
    return parseApplication(await response.json())
  } catch (error) {
    if (error instanceof ApplicantApplicationContractError) throw error
    throw new ApplicantApplicationContractError()
  }
}

export async function createCurrentApplicantApplication(): Promise<ApplicantApplication> {
  const token = csrfToken()
  const response = await fetch('/api/v1/applicant-applications', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: jsonApiMediaType,
      ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
    },
  })
  if (response.status !== 200 && response.status !== 201) {
    throw new ApplicantApplicationHttpError(response.status)
  }
  try {
    return parseApplication(await response.json())
  } catch (error) {
    if (error instanceof ApplicantApplicationContractError) throw error
    throw new ApplicantApplicationContractError()
  }
}

export interface ApplicantApplicationErrorPresentation {
  authenticationRequired: boolean
  message: string
}

export function presentApplicantApplicationError(
  error: unknown,
): ApplicantApplicationErrorPresentation {
  if (error instanceof ApplicantApplicationHttpError && error.status === 401) {
    return {
      authenticationRequired: true,
      message: 'Your session has expired. Sign in to continue.',
    }
  }
  if (error instanceof ApplicantApplicationHttpError && error.status === 403) {
    return {
      authenticationRequired: false,
      message: 'We could not start your application. Refresh and try again.',
    }
  }
  if (error instanceof ApplicantApplicationContractError) {
    return {
      authenticationRequired: false,
      message: 'The service returned an unexpected response. Try again.',
    }
  }
  if (error instanceof ApplicantApplicationHttpError) {
    return {
      authenticationRequired: false,
      message: 'Your application could not be loaded. Try again.',
    }
  }
  return {
    authenticationRequired: false,
    message:
      'We could not connect to the service. Check your connection and try again.',
  }
}
