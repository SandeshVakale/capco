import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import {
  presentRegistrationError,
  registerApplicantAccount,
} from './-applicant-registration-api'
import { CreateAccountForm } from './-create-account-form'
import { parseAccountAccessSearch } from './-return-target'

import type { Route } from './+types/create-account'

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const search = Object.fromEntries(new URL(request.url).searchParams)
  return parseAccountAccessSearch(search)
}

export default function CreateAccountRoute({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate()
  const registration = useMutation({ mutationFn: registerApplicantAccount })

  return (
    <CreateAccountForm
      isSubmitting={registration.isPending}
      isSuccess={registration.isSuccess}
      onNavigate={(href) => {
        void navigate(href)
      }}
      onEdit={() => registration.reset()}
      onValidSubmit={(credentials) => registration.mutateAsync(credentials)}
      returnTo={loaderData.returnTo}
      submissionError={
        registration.isError
          ? presentRegistrationError(registration.error)
          : undefined
      }
    />
  )
}
