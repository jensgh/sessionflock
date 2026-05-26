import { useEffect, useRef, useState } from 'react'

interface PromptModalProps {
  title: string
  label: string
  placeholder?: string
  confirmLabel?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

/** A tiny single-input modal (e.g. naming a task/branch for a new session). */
export function PromptModal({
  title,
  label,
  placeholder,
  confirmLabel = 'Start',
  onSubmit,
  onCancel
}: PromptModalProps): JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div
        className="modal prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">{title}</h2>
        <label className="field">
          <span className="field-label">{label}</span>
          <input
            ref={inputRef}
            className="field-input"
            type="text"
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit(value)
            }}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSubmit(value)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
