import { Alert, Button, Stack, Typography } from '@kyc/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  createCurrentApplicantApplication,
  getCurrentApplicantApplication,
  presentApplicantApplicationError,
  type ApplicantApplication,
} from './-applicant-application-api'
import {
  ApplicantJourneyPresentation,
  type ApplicantJourneyPresentationFixture,
} from './-applicant-journey-presentation'

export default function CurrentApplicationJourneyPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentApplication = useQuery({
    queryKey: ['applicant-application', 'current'],
    queryFn: getCurrentApplicantApplication,
    gcTime: 0,
    retry: false,
  })
  const startApplication = useMutation({
    mutationFn: createCurrentApplicantApplication,
    onSuccess: (application) => {
      queryClient.setQueryData(
        ['applicant-application', 'current'],
        application,
      )
      void navigate(application.href)
    },
  })

  if (currentApplication.isPending) {
    return (
      <main>
        <Typography aria-live="polite" role="status">
          Loading your application…
        </Typography>
      </main>
    )
  }

  if (currentApplication.isError) {
    const error = presentApplicantApplicationError(currentApplication.error)
    return (
      <main>
        <Stack spacing={2}>
          <Alert role="alert" severity="error">
            {error.message}
          </Alert>
          <Button
            onClick={() => {
              if (error.authenticationRequired) {
                void navigate('/sign-in?returnTo=/applications/current')
              } else {
                void currentApplication.refetch()
              }
            }}
          >
            {error.authenticationRequired ? 'Sign in' : 'Try again'}
          </Button>
        </Stack>
      </main>
    )
  }

  const application = currentApplication.data
  const fixture = presentationFixture(application)
  const startError = startApplication.isError
    ? presentApplicantApplicationError(startApplication.error)
    : undefined

  return (
    <Stack spacing={2}>
      {startError ? (
        <Alert role="alert" severity="error">
          {startError.message}
        </Alert>
      ) : null}
      <ApplicantJourneyPresentation
        {...fixture}
        isPrimaryActionPending={startApplication.isPending}
        onPrimaryAction={() => {
          if (application) {
            void navigate(application.href)
          } else if (!startApplication.isPending) {
            startApplication.mutate()
          }
        }}
      />
    </Stack>
  )
}

function presentationFixture(
  application: ApplicantApplication | null,
): ApplicantJourneyPresentationFixture {
  if (application) {
    return {
      entryState: 'resume',
      progress: application.progress.map(({ step, state }) => ({
        step,
        state: state === 'not-started' ? 'remaining' : state,
      })),
    }
  }
  return {
    entryState: 'start',
    progress: [
      { step: 'personal-details', state: 'current' },
      { step: 'identity-and-address', state: 'remaining' },
    ],
  }
}
