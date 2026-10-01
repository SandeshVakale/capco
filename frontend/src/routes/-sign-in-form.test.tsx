import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { SignInForm } from './-sign-in-form'

expect.extend(toHaveNoViolations)

describe('SignInForm', () => {
  it('shows required errors and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the highlighted fields and try again.',
    )
    expect(screen.getByText('Enter your email address.')).toBeVisible()
    expect(screen.getByText('Enter your password.')).toBeVisible()
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('focuses password when it is the first invalid field', async () => {
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.type(screen.getByLabelText('Email address'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Enter your password.')).toBeVisible()
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })

  it('submits trimmed email and password after validation succeeds', async () => {
    const user = userEvent.setup()
    const onValidSubmit = vi.fn()
    render(<SignInForm onValidSubmit={onValidSubmit} />)

    await user.type(
      screen.getByLabelText('Email address'),
      '  user@example.com  ',
    )
    await user.type(screen.getByLabelText('Password'), 'Secure!1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(onValidSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Secure!1',
      })
    })
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('prevents duplicate submission while keeping the pending button focusable', async () => {
    const user = userEvent.setup()
    const onValidSubmit = vi.fn()
    const { rerender } = render(<SignInForm onValidSubmit={onValidSubmit} />)

    await user.type(screen.getByLabelText('Email address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure!1')
    rerender(<SignInForm isSubmitting onValidSubmit={onValidSubmit} />)

    const button = screen.getByRole('button', { name: 'Signing in…' })
    expect(button).toHaveAttribute('data-pending')
    expect(button).not.toBeDisabled()
    expect(screen.getByLabelText('Email address')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
    await user.click(button)
    expect(onValidSubmit).not.toHaveBeenCalled()
  })

  it('shows API field feedback and focuses the relevant field', () => {
    render(
      <SignInForm
        submissionError={{
          message: 'Check the highlighted fields and try again.',
          fieldErrors: { email: 'Enter a valid email address.' },
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the highlighted fields and try again.',
    )
    expect(screen.getByText('Enter a valid email address.')).toBeVisible()
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('keeps email and clears password after a failed submission', async () => {
    const user = userEvent.setup()
    const onValidSubmit = vi.fn().mockRejectedValue(new Error('Rejected'))
    render(<SignInForm onValidSubmit={onValidSubmit} />)

    await user.type(screen.getByLabelText('Email address'), 'user@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secure!1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(onValidSubmit).toHaveBeenCalled())
    expect(screen.getByLabelText('Email address')).toHaveValue(
      'user@example.com',
    )
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(<SignInForm />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
