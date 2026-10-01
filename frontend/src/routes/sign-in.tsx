import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  createApplicantSession,
  presentSignInError,
} from './-applicant-session-api'
import { parseAccountAccessSearch } from './-return-target'
import { SignInForm } from './-sign-in-form'

import type { Route } from './+types/sign-in'

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const search = Object.fromEntries(new URL(request.url).searchParams)
  return parseAccountAccessSearch(search)
}

export default function SignInRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  const signIn = useMutation({ mutationFn: createApplicantSession })

  return (
    <SignInForm
      isSubmitting={signIn.isPending}
      onNavigate={(href) => {
        void navigate(href)
      }}
      onEdit={() => signIn.reset()}
      onValidSubmit={async (credentials) => {
        const session = await signIn.mutateAsync(credentials)
        void navigate(session.href)
      }}
      returnTo={loaderData.returnTo}
      submissionError={
        signIn.isError ? presentSignInError(signIn.error) : undefined
      }
    />
  )
}
