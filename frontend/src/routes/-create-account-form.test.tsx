import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { CreateAccountForm } from './-create-account-form'

expect.extend(toHaveNoViolations)

describe('CreateAccountForm', () => {
  it('shows required errors and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    render(<CreateAccountForm />)

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the highlighted fields and try again.',
    )
    expect(screen.getByLabelText('Email address')).toHaveFocus()
    expect(screen.getByText('Enter an email address.')).toBeVisible()
    expect(screen.getByText('Enter a password.')).toBeVisible()
    expect(screen.getByText('Confirm your password.')).toBeVisible()
  })

  it('validates email, password policy, and matching confirmation', async () => {
    const user = userEvent.setup()
    render(<CreateAccountForm />)

    await user.type(screen.getByLabelText('Email address'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'lowercase')
    await user.type(screen.getByLabelText('Confirm password'), 'different!A')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Enter a valid email address.')).toBeVisible()
    expect(screen.getByText(/Use at least six characters/)).toBeVisible()
    expect(screen.getByText('Passwords must match.')).toBeVisible()
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('submits trimmed email and password after validation succeeds', async () => {
    const user = userEvent.setup()
    const onValidSubmit = vi.fn()
    render(<CreateAccountForm onValidSubmit={onValidSubmit} />)

    await user.type(
      screen.getByLabelText('Email address'),
      '  applicant@example.com  ',
    )
    await user.type(screen.getByLabelText('Password'), 'Secure!1')
    await user.type(screen.getByLabelText('Confirm password'), 'Secure!1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(onValidSubmit).toHaveBeenCalledWith({
        email: 'applicant@example.com',
        password: 'Secure!1',
      })
    })
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm password')).toHaveValue('')
  })

  it('prevents duplicate submission while account creation is pending', () => {
    render(<CreateAccountForm isSubmitting />)

    expect(
      screen.getByRole('button', { name: 'Creating account…' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Email address')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
    expect(screen.getByLabelText('Confirm password')).toBeDisabled()
  })

  it('shows API field validation beside the relevant field', () => {
    render(
      <CreateAccountForm
        submissionError={{
          message: 'Check the highlighted fields and try again.',
          fieldErrors: { email: 'That email cannot be used.' },
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the highlighted fields and try again.',
    )
    expect(screen.getByText('That email cannot be used.')).toBeVisible()
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('confirms success and links to sign in without retaining credentials', () => {
    render(<CreateAccountForm isSuccess returnTo="/applications/current" />)

    expect(
      screen.getByRole('heading', { name: 'Account created' }),
    ).toBeVisible()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Fapplications%2Fcurrent',
    )
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(<CreateAccountForm />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
