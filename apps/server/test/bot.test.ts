import { describe, expect, it } from 'vitest'
import { confirmReply } from '../src/bot'

describe('confirmReply', () => {
  it('mentions a checklist only when one was really posted', () => {
    expect(confirmReply('checklist')).toContain('shared checklist')
    expect(confirmReply('message')).not.toContain('checklist')
    expect(confirmReply('message')).toContain('tick items off')
    expect(confirmReply('none')).not.toContain('checklist')
    expect(confirmReply(undefined)).not.toContain('checklist')
  })
})
