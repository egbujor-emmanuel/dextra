import { useState } from 'react'

type Props = { command: string; dark?: boolean }

/** A shell command with a copy button. Real commands only; the copy confirms with "Copied". */
export function CopyCommand({ command, dark = false }: Props) {
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
  const shell = dark ? 'border-stone/20 bg-stone/[0.06] text-stone' : 'border-ink/25 bg-stone-2/70 text-ink'
  const button = dark ? 'border-stone/30 hover:border-stone' : 'border-ink/30 hover:border-ink'
  return (
    <div className={`flex items-center gap-3 rounded-lg border py-2 pl-4 pr-2 ${shell}`}>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[0.84rem]">{command}</code>
      <button type="button" onClick={handleCopy} className={`shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors active:scale-[0.97] ${button}`} aria-label={`Copy: ${command}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
