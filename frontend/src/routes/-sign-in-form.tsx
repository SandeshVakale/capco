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

import type { SignInSubmissionError } from './-applicant-session-api'

export interface SignInFormProps {
  isSubmitting?: boolean
  onEdit?: () => void
  onNavigate?: (href: string) => void
  onValidSubmit?: (credentials: {
    email: string
    password: string
  }) => void | Promise<void>
  returnTo?: string
  submissionError?: SignInSubmissionError
}

interface SignInErrors {
  email?: string
  password?: string
}

function validateCredentials(email: string, password: string): SignInErrors {
  const errors: SignInErrors = {}
  if (!email.trim()) {
    errors.email = 'Enter your email address.'
  }
  if (!password) {
    errors.password = 'Enter your password.'
  }
  return errors
}

export function SignInForm({
  isSubmitting = false,
  onEdit,
  onNavigate,
  onValidSubmit,
  returnTo,
  submissionError,
}: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<SignInErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const displayedErrors = { ...errors, ...submissionError?.fieldErrors }
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
    }
  }, [displayedErrors.email, displayedErrors.password])

  async function submit(): Promise<void> {
    const validationErrors = validateCredentials(email, password)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    try {
      await onValidSubmit?.({ email: email.trim(), password })
      setPassword('')
    } catch {
      setPassword('')
    }
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
                Welcome back
              </Typography>
              <Typography tone="muted">
                Sign in to continue your KYC application.
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
              autoComplete="current-password"
              disabled={isSubmitting}
              error={Boolean(displayedErrors.password)}
              fullWidth
              helperText={displayedErrors.password}
              id="applicant-password"
              inputRef={passwordInput}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({ ...current, password: undefined }))
                onEdit?.()
              }}
              required
              type="password"
              value={password}
            />
            <Button
              className={styles.submit}
              fullWidth
              isPending={isSubmitting}
              size="large"
              type="submit"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>New to KYC? </span>
              <Link
                href={accountAccessHref('/create-account', returnTo)}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(accountAccessHref('/create-account', returnTo))
                  }
                }}
              >
                Create account
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
