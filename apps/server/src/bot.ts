import { Bot, GrammyError, InlineKeyboard, type Context } from 'grammy'
import { InvalidTransitionError, shortDate, type Agreement } from '@dextra/core'
import type { Db } from './db'
import { ServiceError } from './errors'
import { safeName } from './ids'
import type { AgreementService, Messenger } from './service'

export const ALLOWED_UPDATES = ['message', 'callback_query', 'business_connection', 'business_message', 'edited_business_message'] as const

const AMEND_TTL_MS = 10 * 60_000
const PAIR_ATTEMPTS = 5
const PAIR_WINDOW_MS = 10 * 60_000

function displayName(u: { first_name: string; last_name?: string }): string {
  return safeName([u.first_name, u.last_name].filter(Boolean).join(' '))
}

function bullet(a: Agreement, wearerName: string): string {
  return a.commitments
    .map(c => {
      const who = c.by === 'wearer' ? wearerName : a.counterpartyName
      const tail = [c.amount, c.dueISO ? shortDate(c.dueISO) : c.dueText].filter(Boolean).join(' · ')
      return `• ${who}: ${c.what}${tail ? ` (${tail})` : ''}`
    })
    .join('\n')
}

export function createBot(token: string, env: 'prod' | 'test'): Bot {
  return new Bot(token, env === 'test' ? { client: { environment: 'test' } } : {})
}

/** Telegram side effects for the service, over the wearer's business connection. Plain text only (no parse_mode). */
export class TelegramMessenger implements Messenger {
  constructor(private readonly bot: Bot) {}

  async sendAgreementCard(p: { businessConnectionId: string; chatId: number; wearerName: string; agreement: Agreement; reviewUrl: string }): Promise<void> {
    const text = `What we just agreed, so we both have it:\n\n${bullet(p.agreement, p.wearerName)}\n\nConfirm or change it here: ${p.reviewUrl}\n\n— Dextra · said out loud, confirmed in Telegram`
    await this.bot.api.sendMessage(p.chatId, text, { business_connection_id: p.businessConnectionId, link_preview_options: { is_disabled: true } })
  }

  async postChecklist(p: { businessConnectionId: string; chatId: number; title: string; tasks: string[] }): Promise<{ messageId: number }> {
    const msg = await this.bot.api.sendChecklist(p.businessConnectionId, p.chatId, {
      title: p.title.slice(0, 255),
      tasks: p.tasks.map((text, i) => ({ id: i + 1, text })),
      others_can_mark_tasks_as_done: true,
    })
    return { messageId: msg.message_id }
  }

  async postText(p: { businessConnectionId: string; chatId: number; text: string }): Promise<void> {
    await this.bot.api.sendMessage(p.chatId, p.text.slice(0, 4000), { business_connection_id: p.businessConnectionId, link_preview_options: { is_disabled: true } })
  }

  async sendTracker(p: { chatId: number; agreement: Agreement; wearerName: string }): Promise<void> {
    const text = `Agreed ✓ ${p.wearerName} & ${p.agreement.counterpartyName}\n\nTap each item when it's done. Both of you see the same record.`
    await this.bot.api.sendMessage(p.chatId, text, { reply_markup: trackerKeyboard(p.agreement, p.wearerName) })
  }

  async notify(chatId: number, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text)
  }
}

/** One button per commitment; ☑ when done. Callback data stays far under Telegram's 64-byte limit. */
export function trackerKeyboard(a: Agreement, wearerName: string): InlineKeyboard {
  const kb = new InlineKeyboard()
  a.commitments.forEach((c, i) => {
    const who = c.by === 'wearer' ? wearerName : a.counterpartyName
    kb.text(`${c.done ? '☑' : '☐'} ${who}: ${c.what}`.slice(0, 60), `dn:${a.id}:${i}`).row()
  })
  return kb
}

async function replyError(ctx: Context, e: unknown): Promise<void> {
  const message =
    e instanceof ServiceError ? e.message : e instanceof InvalidTransitionError ? 'That was already handled.' : 'Something went wrong. Please try again.'
  await ctx.reply(message).catch(() => undefined)
}

function createAttemptLimiter(limit: number, windowMs: number) {
  const hits = new Map<number, number[]>()
  return (key: number, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs)
    recent.push(now)
    hits.set(key, recent)
    return recent.length <= limit
  }
}

/** Wires every Telegram update the product needs (PRD §8). */
export function registerHandlers(bot: Bot, service: AgreementService, db: Db, messenger: Messenger): void {
  const pairAttempt = createAttemptLimiter(PAIR_ATTEMPTS, PAIR_WINDOW_MS)

  // Never let one bad update stop polling, and never log payloads (they can contain agreement text).
  bot.catch(err => {
    const e = err.error
    console.error('[dextra] bot', e instanceof GrammyError ? `${e.method} ${e.error_code}` : e instanceof Error ? e.name : 'error')
  })

  bot.command('start', async ctx => {
    const payload = ctx.match?.trim() ?? ''
    if (!payload.startsWith('a_') || !ctx.from) {
      await ctx.reply('Dextra turns what you agree out loud into a note both of you confirm.\n\nWearing Even G2? Send /pair followed by the code on your lens.')
      return
    }
    try {
      const a = await service.forCounterparty(payload.slice(2), ctx.from.id)
      if (a.status !== 'sent') {
        await ctx.reply(a.status === 'confirmed' || a.status === 'fulfilled' ? 'Already confirmed ✓' : 'This agreement is no longer open.')
        return
      }
      const wearer = await db.wearer(a.wearerTgId)
      const kb = new InlineKeyboard().text('Confirm ✓', `ok:${a.id}`).text('Change something', `ch:${a.id}`)
      await ctx.reply(`${wearer?.name ?? 'They'} noted what you agreed:\n\n${bullet(a, wearer?.name ?? 'Them')}\n\nIs this right?`, { reply_markup: kb })
    } catch (e) {
      await replyError(ctx, e)
    }
  })

  bot.command('pair', async ctx => {
    if (ctx.chat.type !== 'private' || !ctx.from) return
    if (!pairAttempt(ctx.from.id)) {
      await ctx.reply('Too many attempts. Wait 10 minutes and use the newest code on your lens.')
      return
    }
    const result = await service.redeemPairCode(ctx.match ?? '', ctx.from.id, displayName(ctx.from))
    const replies = {
      ok: 'Linked ✓\n\nLast step: Telegram ▸ Settings ▸ Chat Automation ▸ add Dextra, so it can send agreements to the people you talk to.',
      invalid: 'That code is wrong, expired or already used. Look at your lens for a fresh one.',
      limit: 'You already have 3 pairs of glasses linked. Unlink one first.',
    }
    await ctx.reply(replies[result])
  })

  bot.on('callback_query:data', async ctx => {
    const [kind, id, item] = ctx.callbackQuery.data.split(':')
    try {
      if (kind === 'dn' && id && item !== undefined) {
        const { agreement, commitment, byWearer } = await service.markDone(id, ctx.from.id, Number(item))
        const wearer = await db.wearer(agreement.wearerTgId)
        const wearerName = wearer?.name ?? 'Them'
        await ctx.editMessageReplyMarkup({ reply_markup: trackerKeyboard(agreement, wearerName) }).catch(() => undefined)
        await ctx.answerCallbackQuery({ text: commitment.done ? 'Marked done ✓' : 'Reopened' })
        const other = byWearer ? agreement.counterpartyTgId : agreement.wearerTgId
        const actor = byWearer ? wearerName : agreement.counterpartyName
        const allDone = agreement.status === 'fulfilled' ? '\n\nEverything agreed is done ✓' : ''
        if (other) await messenger.notify(other, `${actor} ${commitment.done ? 'marked done' : 'reopened'}: ${commitment.what}${allDone}`).catch(() => undefined)
        return
      }
      if (kind === 'ok' && id) {
        const a = await service.confirm(id, ctx.from.id)
        await ctx.answerCallbackQuery({ text: 'Confirmed ✓' })
        await ctx.editMessageReplyMarkup().catch(() => undefined)
        await ctx.reply('Confirmed ✓ A shared checklist is now in your chat. Dictum, factum.')
        await messenger.notify(a.wearerTgId, `${a.counterpartyName} confirmed ✓`).catch(() => undefined)
      } else if (kind === 'ch' && id) {
        await service.forCounterparty(id, ctx.from.id)
        await db.startAmend(ctx.from.id, id, new Date().toISOString())
        await ctx.answerCallbackQuery()
        await ctx.reply('What should change? Reply in one message, e.g. "Monday, not Friday".')
      } else {
        await ctx.answerCallbackQuery()
      }
    } catch (e) {
      await ctx.answerCallbackQuery().catch(() => undefined)
      await replyError(ctx, e)
    }
  })

  bot.on('business_connection', async ctx => {
    const bc = ctx.businessConnection
    const at = new Date().toISOString()
    await db.upsertWearer(bc.user.id, displayName(bc.user), at)
    await db.setBusinessConnection(bc.user.id, bc.id, bc.is_enabled, Boolean(bc.rights?.can_reply), at)
  })

  bot.on('business_message', async ctx => {
    const msg = ctx.businessMessage
    const connectionId = msg.business_connection_id
    const wearer = connectionId ? await db.wearerByConnection(connectionId) : undefined
    if (!wearer || !connectionId) return
    const done = msg.checklist_tasks_done
    if (done?.checklist_message) {
      await service.tick(connectionId, msg.chat.id, done.checklist_message.message_id, done.marked_as_done_task_ids ?? [], done.marked_as_not_done_task_ids ?? [])
      return
    }
    // Only metadata (who wrote, when) is kept, to know who can be messaged. Message text is never stored or forwarded.
    if (msg.from && msg.from.id !== wearer.tg_id && !msg.from.is_bot) {
      await db.upsertContact(wearer.tg_id, { tg_id: msg.from.id, chat_id: msg.chat.id, name: displayName(msg.from), last_incoming_at: new Date(msg.date * 1000).toISOString() })
    }
  })

  bot.on('message:text', async ctx => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return
    const id = await db.peekAmend(ctx.from.id, new Date(Date.now() - AMEND_TTL_MS).toISOString())
    if (!id) return
    try {
      const a = await service.amend(id, ctx.from.id, ctx.message.text.slice(0, 500))
      await db.endAmend(ctx.from.id)
      const wearer = await db.wearer(a.wearerTgId)
      await ctx.reply(`Sent your change to ${wearer?.name ?? 'them'}. They'll accept it on their glasses.`)
    } catch (e) {
      await replyError(ctx, e)
    }
  })
}
