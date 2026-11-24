import { useState } from 'react'

/** A shell command with a real copy button (falls back to selecting the text if the clipboard is unavailable). */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-line bg-ink-2 py-2 pl-4 pr-2 font-mono text-[0.85rem]">
      {label && <span className="text-paper-3">{label}</span>}
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-paper">
        <span className="select-none text-lens-dim">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-sans text-xs text-paper-2 transition-colors hover:border-lens-dim hover:text-lens active:scale-[0.97]"
        aria-label={`Copy command: ${command}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
