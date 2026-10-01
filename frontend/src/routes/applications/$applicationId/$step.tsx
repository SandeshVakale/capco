import {
  Alert,
  Box,
  Button,
  ComboBoxField,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import {
  getApplicantForm,
  presentApplicantFormLoadError,
  presentApplicantFormSaveError,
  saveApplicantForm,
  type ApplicantForm,
  type ApplicantFormAnswerName,
  type ApplicantFormAnswers,
} from '../-applicant-form-api'
import {
  normalizeApplicantFormAnswers,
  validateApplicantFormStep,
  type ApplicantFormValidationErrors,
} from '../-applicant-form-validation'
import {
  presentApplicantSubmissionError,
  submitApplicantApplication,
} from '../-applicant-submission-api'
import { countryOptions, nationalityOptions } from '../-countries'
import styles from '../../application-step.module.css'

import type { ApplicantApplicationStep } from '../-applicant-application-api'
import type { Route } from './+types/$step'

interface FieldDefinition {
  name: Exclude<ApplicantFormAnswerName, 'consentConfirmed'>
  label: string
  autoComplete?: string
  picker?: 'country' | 'nationality'
  type?: 'date' | 'email' | 'tel' | 'text'
}

const fieldDefinitions: Record<
  ApplicantApplicationStep,
  readonly FieldDefinition[]
> = {
  'personal-details': [
    { name: 'name', label: 'Name', autoComplete: 'name' },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    {
      name: 'country',
      label: 'Country',
      autoComplete: 'country-name',
      picker: 'country',
    },
    { name: 'nationality', label: 'Nationality', picker: 'nationality' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  ],
  'identity-and-address': [
    { name: 'documentType', label: 'Document type' },
    { name: 'documentNumber', label: 'Document number' },
    {
      name: 'documentCountry',
      label: 'Document country',
      picker: 'country',
    },
    { name: 'expiry', label: 'Expiry', type: 'date' },
    { name: 'street', label: 'Street', autoComplete: 'street-address' },
    { name: 'city', label: 'City', autoComplete: 'address-level2' },
    { name: 'postal', label: 'Postal code', autoComplete: 'postal-code' },
    {
      name: 'residentialCountry',
      label: 'Residential country',
      autoComplete: 'country-name',
      picker: 'country',
    },
  ],
}

export default function CurrentApplicationStepPage({
  params,
}: Route.ComponentProps) {
  return (
    <ApplicantApplicationStepRoute
      applicationId={params.applicationId}
      stepName={params.step}
    />
  )
}

export function ApplicantApplicationStepRoute({
  applicationId,
  stepName,
}: {
  applicationId: string
  stepName: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const step = parseStep(stepName)
  const isReview = stepName === 'review'
  const form = useQuery({
    queryKey: ['applicant-application-form', applicationId],
    queryFn: () => getApplicantForm(applicationId),
    gcTime: 0,
    retry: false,
    enabled: step !== null || isReview,
  })

  if (!step && !isReview) {
    return (
      <main className={styles.page}>
        <Alert role="alert" severity="error">
          This application step is not available.
        </Alert>
      </main>
    )
  }
  if (form.isPending) {
    return (
      <main className={styles.page}>
        <Typography aria-live="polite" role="status">
          Loading your saved answers…
        </Typography>
      </main>
    )
  }
  if (form.isError) {
    const error = presentApplicantFormLoadError(form.error)
    return (
      <main className={styles.page}>
        <Stack spacing={2}>
          <Alert role="alert" severity="error">
            {error.message}
          </Alert>
          <Button
            onClick={() => {
              if (error.authenticationRequired)
                void navigate('/sign-in?returnTo=/applications/current')
              else void form.refetch()
            }}
          >
            {error.authenticationRequired ? 'Sign in' : 'Try again'}
          </Button>
        </Stack>
      </main>
    )
  }
  if (isReview) {
    return (
      <ReviewApplication
        applicationId={applicationId}
        expectedFormVersion={form.data.version}
        saved={hasSavedNavigationState(location.state)}
      />
    )
  }
  if (!step) return null

  return (
    <ApplicantStepForm
      key={`${form.data.id}:${step}`}
      applicationId={applicationId}
      form={form.data}
      saved={hasSavedNavigationState(location.state)}
      step={step}
    />
  )
}

function ApplicantStepForm({
  applicationId,
  form,
  saved,
  step,
}: {
  applicationId: string
  form: ApplicantForm
  saved: boolean
  step: ApplicantApplicationStep
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<ApplicantFormAnswers>(form.answers)
  const [validationErrors, setValidationErrors] =
    useState<ApplicantFormValidationErrors>({})
  const [version, setVersion] = useState(form.version)
  const submissionInFlight = useRef(false)
  const inputRefs = useRef<
    Partial<Record<ApplicantFormAnswerName, HTMLInputElement | null>>
  >({})
  const save = useMutation({
    mutationFn: (answersToSave: ApplicantFormAnswers) =>
      saveApplicantForm({
        applicationId,
        step,
        answers: answersToSave,
        version,
      }),
    onSuccess: (savedForm) => {
      setVersion(savedForm.version)
      queryClient.setQueryData(
        ['applicant-application-form', applicationId],
        savedForm,
      )
      void navigate(
        step === 'personal-details'
          ? `/applications/${applicationId}/identity-and-address`
          : `/applications/${applicationId}/review`,
        { state: { saved: true } },
      )
    },
    onSettled: () => {
      submissionInFlight.current = false
    },
  })
  const refreshVersion = useMutation({
    mutationFn: () => getApplicantForm(applicationId),
    onSuccess: (latestForm) => {
      setVersion(latestForm.version)
      queryClient.setQueryData(
        ['applicant-application-form', applicationId],
        latestForm,
      )
      save.reset()
    },
  })
  const saveError = save.isError
    ? presentApplicantFormSaveError(save.error)
    : undefined
  const refreshError = refreshVersion.isError
    ? presentApplicantFormLoadError(refreshVersion.error)
    : undefined

  function editAnswers(
    name: ApplicantFormAnswerName,
    update: (current: ApplicantFormAnswers) => ApplicantFormAnswers,
  ) {
    setAnswers(update)
    setValidationErrors((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    save.reset()
  }

  function submit(): void {
    const errors = validateApplicantFormStep(step, answers)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      const focusOrder: ApplicantFormAnswerName[] = [
        ...fieldDefinitions[step].map(({ name }) => name),
        ...(step === 'personal-details' ? (['consentConfirmed'] as const) : []),
      ]
      const firstInvalidField = focusOrder.find((name) => errors[name])
      if (firstInvalidField) inputRefs.current[firstInvalidField]?.focus()
      return
    }
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    const normalizedAnswers = normalizeApplicantFormAnswers(answers)
    setAnswers(normalizedAnswers)
    save.mutate(normalizedAnswers)
  }

  return (
    <main className={styles.page}>
      <Box component="div" className={styles.stepContent}>
        <Stack spacing={3}>
          <Typography component="p" variant="eyebrow" tone="accent">
            STEP {step === 'personal-details' ? '1' : '2'} OF 2
          </Typography>
          <Typography component="h1" variant="heading">
            {step === 'personal-details'
              ? 'Personal details'
              : 'Identity and address'}
          </Typography>
          <Typography tone="muted">
            Your saved answers are loaded from your application.
          </Typography>
          {saved ? (
            <Alert aria-live="polite" role="status" severity="success">
              Your progress was saved.
            </Alert>
          ) : null}
          {saveError ? (
            <Alert aria-live="assertive" role="alert" severity="error">
              {saveError.message}
            </Alert>
          ) : null}
          {refreshError ? (
            <Alert aria-live="assertive" role="alert" severity="error">
              {refreshError.message}
            </Alert>
          ) : null}
          {Object.keys(validationErrors).length > 0 ? (
            <Alert aria-live="assertive" role="alert" severity="error">
              Check the highlighted fields and try again.
            </Alert>
          ) : null}
          {saveError?.authenticationRequired ? (
            <Button
              onClick={() =>
                void navigate('/sign-in?returnTo=/applications/current')
              }
            >
              Sign in
            </Button>
          ) : null}
          {saveError?.conflict ? (
            <Button
              isPending={refreshVersion.isPending}
              onClick={() => refreshVersion.mutate()}
              variant="secondary"
            >
              {refreshVersion.isPending
                ? 'Refreshing version…'
                : 'Refresh form version'}
            </Button>
          ) : null}
          <Stack
            component="form"
            className={styles.stepForm}
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            spacing={2}
          >
            {fieldDefinitions[step].map((field) =>
              field.picker ? (
                <ComboBoxField
                  disabled={save.isPending}
                  error={Boolean(validationErrors[field.name])}
                  fullWidth
                  helperText={validationErrors[field.name]}
                  id={`application-${field.name}`}
                  inputRef={(element) => {
                    inputRefs.current[field.name] = element
                  }}
                  key={field.name}
                  label={`${field.label} (required)`}
                  name={field.name}
                  onChange={(value) =>
                    editAnswers(field.name, (current) => ({
                      ...current,
                      [field.name]: value,
                    }))
                  }
                  options={
                    field.picker === 'country'
                      ? countryOptions
                      : nationalityOptions
                  }
                  required
                  value={answers[field.name] ?? ''}
                />
              ) : (
                <TextField
                  autoComplete={field.autoComplete}
                  disabled={save.isPending}
                  error={Boolean(validationErrors[field.name])}
                  fullWidth
                  helperText={validationErrors[field.name]}
                  inputRef={(element) => {
                    inputRefs.current[field.name] = element
                  }}
                  key={field.name}
                  label={`${field.label} (required)`}
                  {...dateInputBounds(field.name)}
                  name={field.name}
                  onChange={(event) =>
                    editAnswers(field.name, (current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                  required
                  type={field.type ?? 'text'}
                  value={answers[field.name] ?? ''}
                />
              ),
            )}
            {step === 'personal-details' ? (
              <>
                <label className={styles.checkboxField}>
                  <input
                    aria-describedby={
                      validationErrors.consentConfirmed
                        ? 'consent-confirmed-error'
                        : undefined
                    }
                    aria-invalid={Boolean(validationErrors.consentConfirmed)}
                    checked={answers.consentConfirmed ?? false}
                    disabled={save.isPending}
                    name="consentConfirmed"
                    onChange={(event) =>
                      editAnswers('consentConfirmed', (current) => ({
                        ...current,
                        consentConfirmed: event.target.checked,
                      }))
                    }
                    ref={(element) => {
                      inputRefs.current.consentConfirmed = element
                    }}
                    required
                    type="checkbox"
                  />
                  I confirm these details are accurate and belong to me.
                </label>
                {validationErrors.consentConfirmed ? (
                  <Typography id="consent-confirmed-error" role="alert">
                    {validationErrors.consentConfirmed}
                  </Typography>
                ) : null}
              </>
            ) : (
              <Typography role="status" tone="muted">
                {form.documentEvidencePresent
                  ? 'Document evidence already uploaded.'
                  : 'No document evidence is stored yet.'}
              </Typography>
            )}
            <Stack
              component="div"
              className={styles.formActions}
              direction="row"
              spacing={2}
            >
              <Button
                type="button"
                variant="quiet"
                onClick={() =>
                  step === 'personal-details'
                    ? void navigate('/applications/current')
                    : void navigate(
                        `/applications/${applicationId}/personal-details`,
                      )
                }
              >
                Back
              </Button>
              <Button isPending={save.isPending} type="submit">
                {saveButtonLabel(step, save.isPending)}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </main>
  )
}

function ReviewApplication({
  applicationId,
  expectedFormVersion,
  saved,
}: {
  applicationId: string
  expectedFormVersion: number
  saved: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)
  const submission = useMutation({
    mutationFn: () =>
      submitApplicantApplication({ applicationId, expectedFormVersion }),
    onSuccess: (receipt) => {
      queryClient.removeQueries({
        queryKey: ['applicant-application-form', applicationId],
      })
      queryClient.invalidateQueries({
        queryKey: ['applicant-application', 'current'],
      })
      void navigate(`/applications/${applicationId}/submitted`, {
        replace: true,
        state: { receipt },
      })
    },
  })
  const submissionError = submission.isError
    ? presentApplicantSubmissionError(submission.error)
    : undefined

  return (
    <main className={styles.reviewPage}>
      <Box className={styles.reviewCard}>
        <Stack spacing={2}>
          <Typography component="h1" variant="heading">
            Review application
          </Typography>
          <Typography>Your application is ready for review.</Typography>
          {saved ? (
            <Alert aria-live="polite" role="status" severity="success">
              Your progress was saved.
            </Alert>
          ) : null}
          {submissionError ? (
            <Alert aria-live="assertive" role="alert" severity="error">
              {submissionError.message}
            </Alert>
          ) : null}
          {submissionError?.authenticationRequired ? (
            <Button
              onClick={() =>
                void navigate('/sign-in?returnTo=/applications/current')
              }
            >
              Sign in
            </Button>
          ) : null}
          <Stack
            component="form"
            onSubmit={(event) => {
              event.preventDefault()
              if (confirmed && !submission.isPending) submission.mutate()
            }}
            spacing={2}
          >
            <label className={styles.checkboxField}>
              <input
                checked={confirmed}
                disabled={submission.isPending}
                onChange={(event) => {
                  setConfirmed(event.target.checked)
                  submission.reset()
                }}
                required
                type="checkbox"
              />{' '}
              I confirm the information is complete and accurate.
            </label>
            <Button
              disabled={!confirmed}
              isPending={submission.isPending}
              type="submit"
            >
              {submission.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
          </Stack>
          <Button
            disabled={submission.isPending}
            variant="secondary"
            onClick={() =>
              void navigate(
                `/applications/${applicationId}/identity-and-address`,
              )
            }
          >
            Return to form
          </Button>
        </Stack>
      </Box>
    </main>
  )
}

function parseStep(value: string): ApplicantApplicationStep | null {
  return value === 'personal-details' || value === 'identity-and-address'
    ? value
    : null
}

function hasSavedNavigationState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'saved' in state &&
    state.saved === true
  )
}

function saveButtonLabel(
  step: ApplicantApplicationStep,
  isPending: boolean,
): string {
  if (isPending) return 'Saving…'
  return step === 'personal-details' ? 'Save and continue' : 'Save and review'
}

function localIsoDate(): string {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputBounds(name: ApplicantFormAnswerName): {
  min?: string
  max?: string
} {
  if (name === 'dateOfBirth') {
    return { min: '1900-01-01', max: localIsoDate() }
  }
  if (name === 'expiry') {
    return { min: localIsoDate(), max: '9999-12-31' }
  }
  return {}
}
