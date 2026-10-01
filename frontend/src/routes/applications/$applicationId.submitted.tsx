import { Alert, Button, Typography } from '@kyc/ui'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'

import {
  getApplicantSubmissionReceipt,
  presentApplicantSubmissionError,
  type ApplicantSubmissionReceipt,
} from './-applicant-submission-api'

import type { Route } from './+types/$applicationId.submitted'

export default function SubmissionReceiptPage({
  params,
}: Route.ComponentProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationReceipt = receiptFromNavigationState(location.state)
  const receipt = useQuery({
    queryKey: ['applicant-application-submission', params.applicationId],
    queryFn: () => getApplicantSubmissionReceipt(params.applicationId),
    initialData: navigationReceipt,
    retry: false,
  })

  if (receipt.isPending) {
    return (
      <main className="submission-receipt__main">
        <Typography aria-live="polite" role="status">
          Confirming your submission…
        </Typography>
      </main>
    )
  }

  if (receipt.isError) {
    const error = presentApplicantSubmissionError(receipt.error)
    return (
      <main className="submission-receipt__main">
        <Alert role="alert" severity="error">
          {error.message}
        </Alert>
        <Button onClick={() => void navigate('/applications/current')}>
          Return to your application
        </Button>
      </main>
    )
  }

  return (
    <div className="submission-receipt">
      <header className="submission-receipt__header">
        <Typography component="span" variant="subheading">
          KYC Application
        </Typography>
      </header>
      <main className="submission-receipt__main">
        <Typography component="p" variant="eyebrow" tone="accent">
          APPLICATION RECEIVED
        </Typography>
        <Typography component="h1" variant="heading">
          Application submitted
        </Typography>
        <Typography component="p" tone="muted">
          {receipt.data.nextStep}
        </Typography>
        <Alert
          role="status"
          severity="success"
          className="submission-receipt__alert"
        >
          {receipt.data.message}
        </Alert>
        <Button
          variant="quiet"
          onClick={() => void navigate('/applications/current')}
        >
          DONE
        </Button>
      </main>
    </div>
  )
}

function receiptFromNavigationState(
  state: unknown,
): ApplicantSubmissionReceipt | undefined {
  if (
    typeof state === 'object' &&
    state !== null &&
    'receipt' in state &&
    typeof state.receipt === 'object' &&
    state.receipt !== null &&
    'message' in state.receipt &&
    typeof state.receipt.message === 'string' &&
    'nextStep' in state.receipt &&
    typeof state.receipt.nextStep === 'string' &&
    'submittedAt' in state.receipt &&
    typeof state.receipt.submittedAt === 'string'
  ) {
    return state.receipt as ApplicantSubmissionReceipt
  }
  return undefined
}
