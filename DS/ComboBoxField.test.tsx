import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ComboBoxField } from './ComboBoxField'

expect.extend(toHaveNoViolations)

const options = [
  { value: 'France', label: 'France' },
  {
    value: 'United Kingdom',
    label: 'United Kingdom',
    textValue: 'United Kingdom UK Great Britain',
  },
]

describe('ComboBoxField', () => {
  it('filters options and reports keyboard selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    function TestComboBox() {
      const [value, setValue] = useState('')
      return (
        <ComboBoxField
          id="country"
          label="Country"
          onChange={(nextValue) => {
            setValue(nextValue)
            onChange(nextValue)
          }}
          options={options}
          value={value}
        />
      )
    }
    render(<TestComboBox />)

    const input = screen.getByRole('combobox', { name: 'Country' })
    await user.type(input, 'UK')
    expect(
      await screen.findByRole('option', { name: 'United Kingdom' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'France' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenLastCalledWith('United Kingdom')
  })

  it('preserves a previously saved value that is not in the current list', () => {
    render(
      <ComboBoxField
        id="country"
        label="Country"
        onChange={() => {}}
        options={options}
        value="Historical country value"
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue(
      'Historical country value',
    )
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(
      <ComboBoxField
        error
        helperText="Choose a country from the list."
        id="country"
        label="Country"
        onChange={() => {}}
        options={options}
        required
        value=""
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
