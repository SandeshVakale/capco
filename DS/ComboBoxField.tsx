import { useMemo, type ReactNode, type Ref } from 'react'
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from 'react-aria-components'

import styles from './ComboBoxField.module.css'

export interface ComboBoxFieldOption {
  value: string
  label: string
  textValue?: string
}

export interface ComboBoxFieldProps {
  disabled?: boolean
  error?: boolean
  fullWidth?: boolean
  helperText?: ReactNode
  id: string
  inputRef?: Ref<HTMLInputElement>
  label: ReactNode
  name?: string
  onChange: (value: string) => void
  options: readonly ComboBoxFieldOption[]
  required?: boolean
  value: string
}

export function ComboBoxField({
  disabled = false,
  error = false,
  fullWidth = false,
  helperText,
  id,
  inputRef,
  label,
  name,
  onChange,
  options,
  required = false,
  value,
}: ComboBoxFieldProps) {
  const selectedKey = useMemo(
    () => options.find((option) => option.value === value)?.value ?? null,
    [options, value],
  )

  return (
    <ComboBox
      allowsCustomValue
      className={[styles.comboBox, fullWidth && styles.fullWidth]
        .filter(Boolean)
        .join(' ')}
      defaultFilter={(textValue, inputValue) =>
        textValue.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase())
      }
      id={id}
      inputValue={value}
      isDisabled={disabled}
      isInvalid={error}
      isRequired={required}
      onInputChange={(inputValue) => {
        const selected = options.find(
          (option) => (option.textValue ?? option.label) === inputValue,
        )
        onChange(selected?.value ?? inputValue)
      }}
      onSelectionChange={(key) => {
        const selected = options.find((option) => option.value === key)
        if (selected) onChange(selected.value)
      }}
      selectedKey={selectedKey}
    >
      <Label>{label}</Label>
      <div className={styles.control}>
        <Input className={styles.input} name={name} ref={inputRef} />
        <Button aria-label="Show suggestions" className={styles.button}>
          <span aria-hidden="true">⌄</span>
        </Button>
      </div>
      {helperText !== undefined && helperText !== null ? (
        <Text
          className={styles.description}
          slot={error ? 'errorMessage' : 'description'}
        >
          {helperText}
        </Text>
      ) : null}
      <Popover className={styles.popover}>
        <ListBox className={styles.list} items={options}>
          {(option) => (
            <ListBoxItem
              className={styles.option}
              id={option.value}
              textValue={option.textValue ?? option.label}
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
