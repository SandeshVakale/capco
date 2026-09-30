import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TextField } from './Primitives'

describe('TextField', () => {
  it('exposes required and disabled state through React Aria', () => {
    render(<TextField disabled label="Email address" name="email" required />)

    const input = screen.getByRole('textbox', { name: 'Email address' })
    expect(input).toBeRequired()
    expect(input).toBeDisabled()
    expect(input.closest('[data-required]')).toHaveAttribute('data-disabled')
  })

  it('associates an invalid field with its error message', () => {
    render(
      <TextField
        error
        helperText="Enter a valid email address."
        label="Email address"
        name="email"
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Email address' })
    const error = screen.getByText('Enter a valid email address.')
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription(error.textContent ?? '')
  })
})
