import { useEffect, useRef, useState } from 'react'

interface PromptModalProps {
  title: string
  label: string
  placeholder?: string
  confirmLabel?: string
  /** Show a "Run in a git worktree" checkbox (worktree mode = "ask"). */
  showWorktree?: boolean
  worktreeDefault?: boolean
  onSubmit: (value: string, useWorktree: boolean) => void
  /** Start the session right away without naming it (and without a worktree). */
  onSkip?: () => void
  onCancel: () => void
}

/** A small new-session dialog: a task name and (optionally) a worktree toggle. */
export function PromptModal({
  title,
  label,
  placeholder,
  confirmLabel = 'Start',
  showWorktree = false,
  worktreeDefault = false,
  onSubmit,
  onSkip,
  onCancel
}: PromptModalProps): JSX.Element {
  const [value, setValue] = useState('')
  const [useWorktree, setUseWorktree] = useState(worktreeDefault)
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

  const submit = (): void => onSubmit(value, useWorktree)

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
              if (e.key === 'Enter') submit()
            }}
          />
        </label>
        {showWorktree && (
          <label className="field">
            <span className="field-label">
              <input
                type="checkbox"
                checked={useWorktree}
                onChange={(e) => setUseWorktree(e.target.checked)}
              />{' '}
              Run in a fresh git worktree
            </span>
            <span className="field-hint">
              Creates a clean checkout on a new branch (named from above) so this
              session doesn't collide with others. Only if the folder is a git repo.
            </span>
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          {onSkip && (
            <button type="button" className="btn" onClick={onSkip}>
              Skip
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={submit}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
