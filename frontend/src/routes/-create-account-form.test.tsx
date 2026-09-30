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
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(<CreateAccountForm />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
