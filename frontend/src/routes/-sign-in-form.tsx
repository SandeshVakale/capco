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

export interface SignInFormProps {
  onNavigate?: (href: string) => void
  onValidSubmit?: (credentials: {
    email: string
    password: string
  }) => void | Promise<void>
  returnTo?: string
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
  onNavigate,
  onValidSubmit,
  returnTo,
}: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<SignInErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const hasErrors = Object.values(errors).some(Boolean)

  useEffect(() => {
    if (errors.email) {
      emailInput.current?.focus()
    } else if (errors.password) {
      passwordInput.current?.focus()
    }
  }, [errors])

  async function submit(): Promise<void> {
    const validationErrors = validateCredentials(email, password)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    await onValidSubmit?.({ email: email.trim(), password })
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
            {hasErrors ? (
              <Alert aria-live="assertive" role="alert" severity="error">
                Check the highlighted fields and try again.
              </Alert>
            ) : null}
            <TextField
              autoComplete="email"
              error={Boolean(errors.email)}
              fullWidth
              helperText={errors.email}
              id="applicant-email"
              inputRef={emailInput}
              label="Email address"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((current) => ({ ...current, email: undefined }))
              }}
              required
              type="email"
              value={email}
            />
            <TextField
              autoComplete="current-password"
              error={Boolean(errors.password)}
              fullWidth
              helperText={errors.password}
              id="applicant-password"
              inputRef={passwordInput}
              label="Password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({ ...current, password: undefined }))
              }}
              required
              type="password"
              value={password}
            />
            <Button
              className={styles.submit}
              fullWidth
              size="large"
              type="submit"
            >
              Sign in
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
