import { useState } from 'react'

type Props = { command: string }

/** A real shell command in a neubrutalist box with a copy button that confirms with "Copied". */
export function CopyCommand({ command }: Props) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex items-center gap-3 border-[3px] border-black bg-paper py-1.5 pl-4 pr-1.5 text-ink">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[0.9rem]">
        <span aria-hidden className="select-none text-red">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="min-h-11 min-w-16 shrink-0 border-[3px] border-black bg-ink px-3 font-display text-[0.85rem] font-bold text-white transition-transform active:translate-x-0.5 active:translate-y-0.5"
        aria-label={`Copy: ${command}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
