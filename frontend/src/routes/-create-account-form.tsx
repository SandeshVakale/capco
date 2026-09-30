import {
  Alert,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useEffect, useRef, useState } from 'react'

import { accountAccessHref } from './-return-target'
import styles from './account-access.module.css'

import type { RegistrationSubmissionError } from './-applicant-registration-api'

export interface CreateAccountFormProps {
  isSubmitting?: boolean
  isSuccess?: boolean
  onEdit?: () => void
  onNavigate?: (href: string) => void
  onValidSubmit?: (credentials: {
    email: string
    password: string
  }) => void | Promise<void>
  returnTo?: string
  submissionError?: RegistrationSubmissionError
}

const passwordGuidance =
  'Use at least six characters, including one uppercase letter and one special character.'

interface RegistrationErrors {
  email?: string
  password?: string
  passwordConfirmation?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uppercasePattern = /\p{Lu}/u
const specialCharacterPattern = /[^\p{L}\p{N}]/u

function validateRegistration(
  email: string,
  password: string,
  passwordConfirmation: string,
): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    errors.email = 'Enter an email address.'
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Enter a password.'
  } else if (
    password.length < 6 ||
    !uppercasePattern.test(password) ||
    !specialCharacterPattern.test(password)
  ) {
    errors.password = passwordGuidance
  }

  if (!passwordConfirmation) {
    errors.passwordConfirmation = 'Confirm your password.'
  } else if (passwordConfirmation !== password) {
    errors.passwordConfirmation = 'Passwords must match.'
  }

  return errors
}

export function CreateAccountForm({
  isSubmitting = false,
  isSuccess = false,
  onEdit,
  onNavigate,
  onValidSubmit,
  returnTo,
  submissionError,
}: CreateAccountFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const passwordConfirmationInput = useRef<HTMLInputElement>(null)
  const displayedErrors = {
    ...errors,
    ...submissionError?.fieldErrors,
  }
  const errorMessage =
    submissionError?.message ??
    (Object.values(errors).some(Boolean)
      ? 'Check the highlighted fields and try again.'
      : undefined)

  useEffect(() => {
    if (displayedErrors.email) {
      emailInput.current?.focus()
    } else if (displayedErrors.password) {
      passwordInput.current?.focus()
    } else if (displayedErrors.passwordConfirmation) {
      passwordConfirmationInput.current?.focus()
    }
  }, [
    displayedErrors.email,
    displayedErrors.password,
    displayedErrors.passwordConfirmation,
  ])

  async function submit(): Promise<void> {
    const validationErrors = validateRegistration(
      email,
      password,
      passwordConfirmation,
    )
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    try {
      await onValidSubmit?.({ email: email.trim(), password })
      setPassword('')
      setPasswordConfirmation('')
    } catch {
      // The route exposes rejected submission feedback through submissionError.
    }
  }

  const signInHref = accountAccessHref('/sign-in', returnTo)

  if (isSuccess) {
    return (
      <main className={styles.page}>
        <Card className={styles.card}>
          <CardContent className={styles.cardContent}>
            <Stack spacing={3}>
              <Typography component="h1" variant="heading">
                Account created
              </Typography>
              <Alert aria-live="polite" role="status" severity="success">
                Your account has been created. Sign in to continue your KYC
                application.
              </Alert>
              <Link
                href={signInHref}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(signInHref)
                  }
                }}
              >
                Sign in
              </Link>
            </Stack>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack
            component="form"
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            spacing={3}
          >
            <Stack spacing={1}>
              <Typography component="h1" variant="heading">
                Create your account
              </Typography>
              <Typography tone="muted">
                Create credentials to begin your KYC application.
              </Typography>
            </Stack>
            {errorMessage ? (
              <Alert aria-live="assertive" role="alert" severity="error">
                {errorMessage}
              </Alert>
            ) : null}
            <TextField
              autoComplete="email"
              disabled={isSubmitting}
              error={Boolean(displayedErrors.email)}
              fullWidth
              helperText={displayedErrors.email}
              id="applicant-email"
              inputRef={emailInput}
              label="Email address"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((current) => ({ ...current, email: undefined }))
                onEdit?.()
              }}
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="new-password"
              disabled={isSubmitting}
              error={Boolean(displayedErrors.password)}
              fullWidth
              helperText={displayedErrors.password ?? passwordGuidance}
              id="applicant-password"
              inputRef={passwordInput}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({
                  ...current,
                  password: undefined,
                  passwordConfirmation: undefined,
                }))
                onEdit?.()
              }}
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              disabled={isSubmitting}
              error={Boolean(displayedErrors.passwordConfirmation)}
              fullWidth
              helperText={displayedErrors.passwordConfirmation}
              id="applicant-password-confirmation"
              inputRef={passwordConfirmationInput}
              label="Confirm password"
              name="passwordConfirmation"
              onChange={(event) => {
                setPasswordConfirmation(event.target.value)
                setErrors((current) => ({
                  ...current,
                  passwordConfirmation: undefined,
                }))
                onEdit?.()
              }}
              required
              type="password"
              value={passwordConfirmation}
            />
            <Button
              className={styles.submit}
              fullWidth
              isDisabled={isSubmitting}
              size="large"
              type="submit"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>Already have an account? </span>
              <Link
                href={signInHref}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(signInHref)
                  }
                }}
              >
                Sign in
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
