import { Alert, Box, Button, Stack, TextField, Typography } from '@kyc/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  getApplicantForm,
  presentApplicantFormLoadError,
  type ApplicantForm,
  type ApplicantFormAnswerName,
  type ApplicantFormAnswers,
} from '../-applicant-form-api'
import styles from '../../application-step.module.css'

import type { ApplicantApplicationStep } from '../-applicant-application-api'
import type { Route } from './+types/$step'

interface FieldDefinition {
  name: Exclude<ApplicantFormAnswerName, 'consentConfirmed'>
  label: string
  autoComplete?: string
  type?: 'date' | 'email' | 'tel' | 'text'
}

const fieldDefinitions: Record<
  ApplicantApplicationStep,
  readonly FieldDefinition[]
> = {
  'personal-details': [
    { name: 'name', label: 'Name', autoComplete: 'name' },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    { name: 'country', label: 'Country', autoComplete: 'country-name' },
    { name: 'nationality', label: 'Nationality' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  ],
  'identity-and-address': [
    { name: 'documentType', label: 'Document type' },
    { name: 'documentNumber', label: 'Document number' },
    { name: 'documentCountry', label: 'Document country' },
    { name: 'expiry', label: 'Expiry', type: 'date' },
    { name: 'street', label: 'Street', autoComplete: 'street-address' },
    { name: 'city', label: 'City', autoComplete: 'address-level2' },
    { name: 'postal', label: 'Postal code', autoComplete: 'postal-code' },
    {
      name: 'residentialCountry',
      label: 'Residential country',
      autoComplete: 'country-name',
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
  const step = parseStep(stepName)
  const form = useQuery({
    queryKey: ['applicant-application-form', applicationId],
    queryFn: () => getApplicantForm(applicationId),
    gcTime: 0,
    retry: false,
    enabled: step !== null,
  })

  if (stepName === 'review')
    return <ReviewPrototype applicationId={applicationId} />
  if (!step) {
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

  return (
    <ApplicantStepForm
      key={`${form.data.id}:${step}:${form.data.version}`}
      applicationId={applicationId}
      form={form.data}
      step={step}
    />
  )
}

function ApplicantStepForm({
  applicationId,
  form,
  step,
}: {
  applicationId: string
  form: ApplicantForm
  step: ApplicantApplicationStep
}) {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<ApplicantFormAnswers>(form.answers)
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
          <Stack
            component="form"
            className={styles.stepForm}
            onSubmit={(event) => {
              event.preventDefault()
              if (!event.currentTarget.reportValidity()) return
              void navigate(
                step === 'personal-details'
                  ? `/applications/${applicationId}/identity-and-address`
                  : `/applications/${applicationId}/review`,
              )
            }}
            spacing={2}
          >
            {fieldDefinitions[step].map((field) => (
              <TextField
                autoComplete={field.autoComplete}
                fullWidth
                key={field.name}
                label={`${field.label} (required)`}
                name={field.name}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                required
                type={field.type ?? 'text'}
                value={answers[field.name] ?? ''}
              />
            ))}
            {step === 'personal-details' ? (
              <label className={styles.checkboxField}>
                <input
                  checked={answers.consentConfirmed ?? false}
                  name="consentConfirmed"
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      consentConfirmed: event.target.checked,
                    }))
                  }
                  required
                  type="checkbox"
                />
                I confirm these details are accurate and belong to me.
              </label>
            ) : (
              <>
                <label htmlFor="document-evidence">
                  Document evidence{' '}
                  {form.documentEvidencePresent ? '(uploaded)' : '(required)'}
                </label>
                {form.documentEvidencePresent ? (
                  <Typography role="status" tone="muted">
                    Document evidence already uploaded.
                  </Typography>
                ) : null}
                <input
                  id="document-evidence"
                  name="documentEvidence"
                  type="file"
                  accept="image/jpeg,image/png"
                  required={!form.documentEvidencePresent}
                />
              </>
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
              <Button type="submit">
                {step === 'personal-details' ? 'Continue' : 'Save and review'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </main>
  )
}

function ReviewPrototype({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate()
  return (
    <main className={styles.reviewPage}>
      <Box className={styles.reviewCard}>
        <Stack spacing={2}>
          <Typography component="h1" variant="heading">
            Review application
          </Typography>
          <Typography>Your application is ready for review.</Typography>
          <label className={styles.checkboxField}>
            <input type="checkbox" /> I confirm the information is complete and
            accurate.
          </label>
          <Button
            onClick={() =>
              void navigate(`/applications/${applicationId}/submitted`)
            }
          >
            Submit
          </Button>
          <Button
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
