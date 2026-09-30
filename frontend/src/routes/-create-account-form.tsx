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

export interface CreateAccountFormProps {
  onNavigate?: (href: string) => void
  onValidSubmit?: (credentials: {
    email: string
    password: string
  }) => void | Promise<void>
  returnTo?: string
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
  onNavigate,
  onValidSubmit,
  returnTo,
}: CreateAccountFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const passwordConfirmationInput = useRef<HTMLInputElement>(null)
  const hasErrors = Object.values(errors).some(Boolean)

  useEffect(() => {
    if (errors.email) {
      emailInput.current?.focus()
    } else if (errors.password) {
      passwordInput.current?.focus()
    } else if (errors.passwordConfirmation) {
      passwordConfirmationInput.current?.focus()
    }
  }, [errors])

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
                Create your account
              </Typography>
              <Typography tone="muted">
                Create credentials to begin your KYC application.
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
              autoComplete="new-password"
              error={Boolean(errors.password)}
              fullWidth
              helperText={errors.password ?? passwordGuidance}
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
              }}
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              error={Boolean(errors.passwordConfirmation)}
              fullWidth
              helperText={errors.passwordConfirmation}
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
              }}
              required
              type="password"
              value={passwordConfirmation}
            />
            <Button
              className={styles.submit}
              fullWidth
              size="large"
              type="submit"
            >
              Create account
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>Already have an account? </span>
              <Link
                href={accountAccessHref('/sign-in', returnTo)}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(accountAccessHref('/sign-in', returnTo))
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
