import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  it('renders an accessible React Aria button', () => {
    render(<Button>Continue</Button>)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined()
  })

  it('prevents interaction while pending without removing focusability', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <Button isPending onPress={onPress}>
        Save
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    await user.tab()
    expect(button).toHaveFocus()
    await user.click(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button).toHaveAttribute('data-pending')
  })
})
