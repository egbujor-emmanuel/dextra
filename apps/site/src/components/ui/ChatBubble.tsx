interface ChatBubbleProps {
  /** Who it appears to come from in Telegram. */
  from: 'you' | 'bot'
  sender: string
  text: string
  buttons?: string[]
  className?: string
}

/** Exact message wording from apps/server/src/bot.ts and service.ts; names are examples. */
export function ChatBubble({ from, sender, text, buttons, className = '' }: ChatBubbleProps) {
  const mine = from === 'you'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`max-w-[34ch] rounded-2xl px-4 py-3 text-[0.92rem] leading-relaxed ${mine ? 'rounded-br-md bg-bubble-out' : 'rounded-bl-md bg-bubble'} border border-line/70`}>
        <p className="mb-1 text-[0.72rem] font-medium tracking-wide text-paper-3">{sender}</p>
        <p className="whitespace-pre-line text-paper">{text}</p>
        {buttons && (
          <div className="mt-3 grid gap-1.5">
            {buttons.map(b => (
              <span key={b} className="rounded-lg border border-line bg-ink-2/80 px-3 py-1.5 text-center text-[0.82rem] text-paper-2">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
