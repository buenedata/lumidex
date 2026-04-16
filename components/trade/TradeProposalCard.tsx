'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TPUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface TPCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  image: string | null
  sets?: { name: string | null; logo_url: string | null } | Array<{ name: string | null; logo_url: string | null }>
}

interface TPItem {
  id: string
  direction: 'offering' | 'requesting'
  quantity: number
  cards: TPCard | null
}

export interface TradeProposal {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
  notes: string | null
  created_at: string
  updated_at: string
  proposer_id: string
  receiver_id: string
  cash_offered: number
  cash_requested: number
  currency_code: string
  isProposer: boolean
  otherUser: TPUser | null
  trade_proposal_items: TPItem[]
}

interface TradeProposalCardProps {
  proposal: TradeProposal
  onStatusChange: (id: string, newStatus: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmtCash(amount: number, code: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: code, maximumFractionDigits: 2,
  }).format(amount)
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  accepted:  'bg-price/15 text-price border-price/30',
  declined:  'bg-red-500/15 text-red-400 border-red-500/30',
  withdrawn: 'bg-surface text-muted border-subtle',
}
const STATUS_LABELS: Record<string, string> = {
  pending:   '⏳ Pending',
  accepted:  '✅ Accepted',
  declined:  '❌ Declined',
  withdrawn: '↩ Withdrawn',
}

// ── Detailed card tile ────────────────────────────────────────────────────────
function CardDetailTile({ item }: { item: TPItem }) {
  const card = item.cards
  if (!card) return null
  const setInfo = (Array.isArray(card.sets) ? card.sets[0] : card.sets) as { name: string | null; logo_url: string | null } | null

  return (
    <div className="flex flex-col items-start gap-1.5 w-[90px] shrink-0">
      {/* Card image */}
      <div className="relative w-[90px] h-[125px] rounded-xl overflow-hidden border border-subtle bg-surface group">
        <img
          src={card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Set logo overlay */}
        {setInfo?.logo_url && (
          <img
            src={setInfo.logo_url}
            alt=""
            className="absolute bottom-1 right-1 h-4 w-auto object-contain opacity-80"
          />
        )}
        {/* Quantity badge if > 1 */}
        {item.quantity > 1 && (
          <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            ×{item.quantity}
          </span>
        )}
      </div>

      {/* Card name */}
      <p className="text-[11px] font-semibold text-primary leading-tight line-clamp-2 w-full">
        {card.name ?? '—'}
      </p>

      {/* Set + number */}
      <p className="text-[10px] text-muted leading-tight truncate w-full">
        {setInfo?.name ?? ''}
        {card.number ? ` · #${card.number}` : ''}
      </p>

      {/* Price */}
      <span className="text-xs text-gray-400 italic">Prices coming soon</span>
    </div>
  )
}

// ── Card side panel ───────────────────────────────────────────────────────────
function CardSidePanel({
  label,
  labelClass,
  items,
  cashAmount,
  currencyCode,
}: {
  label: string
  labelClass: string
  items: TPItem[]
  cashAmount: number
  currencyCode: string
}) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${labelClass}`}>{label}</p>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {items.map(item => (
            <CardDetailTile
              key={item.id}
              item={item}
            />
          ))}
        </div>
      ) : cashAmount === 0 ? (
        <p className="text-sm text-muted italic">Nothing offered</p>
      ) : null}

      {cashAmount > 0 && (
        <div className="inline-flex items-center gap-2 bg-price/10 border border-price/30 rounded-xl px-4 py-2.5 w-fit">
          <span className="text-lg">💵</span>
          <div>
            <p className="text-xs text-muted leading-none mb-0.5">Cash</p>
            <p className="text-base font-bold text-price leading-none">{fmtCash(cashAmount, currencyCode)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradeProposalCard({ proposal, onStatusChange }: TradeProposalCardProps) {
  const [acting, setActing] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const { profile } = useAuthStore()
  const userCurrency: string = (profile as any)?.preferred_currency ?? 'USD'

  const { otherUser, isProposer, status } = proposal
  const otherName = otherUser?.display_name ?? otherUser?.username ?? 'Trainer'

  const offeringItems   = proposal.trade_proposal_items.filter(i => i.direction === 'offering')
  const requestingItems = proposal.trade_proposal_items.filter(i => i.direction === 'requesting')

  const myOfferItems   = isProposer ? offeringItems   : requestingItems
  const theirItems     = isProposer ? requestingItems : offeringItems
  const myCashOffer    = isProposer ? proposal.cash_offered   : proposal.cash_requested
  const theirCashOffer = isProposer ? proposal.cash_requested : proposal.cash_offered

  async function act(newStatus: 'accepted' | 'declined' | 'withdrawn') {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/trade-proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Action failed')
        return
      }
      onStatusChange(proposal.id, newStatus)
    } catch {
      setError('Network error')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="bg-elevated border border-subtle rounded-2xl overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center">
            {otherUser?.avatar_url ? (
              <Image
                src={otherUser.avatar_url}
                alt={otherName}
                width={40} height={40}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-sm font-bold text-accent">{otherName[0].toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-primary leading-tight truncate">{otherName}</p>
            <p className="text-xs text-muted leading-tight">
              {isProposer ? 'You proposed · ' : 'They proposed · '}
              {relativeTime(proposal.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-surface border border-subtle text-muted">
            {proposal.currency_code}
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
      </div>

      {/* ── Body: two panels ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-subtle">
        <CardSidePanel
          label="Your Offer"
          labelClass="text-accent"
          items={myOfferItems}
          cashAmount={myCashOffer}
          currencyCode={proposal.currency_code}
        />
        <CardSidePanel
          label={`${otherName} Offers`}
          labelClass="text-price"
          items={theirItems}
          cashAmount={theirCashOffer}
          currencyCode={proposal.currency_code}
        />
      </div>

      {/* ── Notes ── */}
      {proposal.notes && (
        <div className="px-5 py-3 border-t border-subtle bg-surface/50">
          <p className="text-xs text-muted mb-1 font-medium">Note</p>
          <p className="text-sm text-secondary leading-relaxed">{proposal.notes}</p>
        </div>
      )}

      {/* ── Actions ── */}
      {status === 'pending' && (
        <div className="px-5 py-3 border-t border-subtle flex items-center justify-between gap-3 flex-wrap">
          {error
            ? <p className="text-xs text-red-400">{error}</p>
            : <div />
          }
          <div className="flex items-center gap-2 flex-wrap">
            {!isProposer && (
              <>
                <button
                  onClick={() => act('declined')}
                  disabled={acting}
                  className="h-9 px-4 rounded-xl border border-subtle text-secondary text-sm font-medium hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  Decline
                </button>
                {/* Counter offer — swap offer/request and link to trade page */}
                <Link
                  href={`/trade?with=${proposal.proposer_id}&counter=${proposal.id}&offer=${
                    proposal.trade_proposal_items.filter(i => i.direction === 'requesting').map(i => i.cards?.id).filter(Boolean).join(',')
                  }&request=${
                    proposal.trade_proposal_items.filter(i => i.direction === 'offering').map(i => i.cards?.id).filter(Boolean).join(',')
                  }`}
                  className="h-9 px-4 rounded-xl border border-accent/40 text-accent text-sm font-medium hover:bg-accent/10 transition-colors inline-flex items-center gap-1.5"
                >
                  ↩ Counter
                </Link>
                <button
                  onClick={() => act('accepted')}
                  disabled={acting}
                  className="h-9 px-5 rounded-xl bg-price text-white text-sm font-semibold hover:bg-price/80 transition-colors disabled:opacity-40"
                >
                  {acting ? 'Saving…' : '✓ Accept'}
                </button>
              </>
            )}
            {isProposer && (
              <button
                onClick={() => act('withdrawn')}
                disabled={acting}
                className="h-9 px-4 rounded-xl border border-subtle text-muted text-sm font-medium hover:text-secondary hover:border-accent/40 transition-colors disabled:opacity-40"
              >
                {acting ? 'Saving…' : 'Withdraw'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
