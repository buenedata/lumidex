'use client'

interface DashboardStatsProps {
  totalCards: number
  setsTracked: number
  completedSets: number
  setsAvailable: number
}

interface StatCardProps {
  label: string
  value: string | number
  textClass: string
  borderClass: string
  icon: React.ReactNode
}

function StatCard({ label, value, textClass, borderClass, icon }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-surface border border-subtle ${borderClass} rounded-xl p-4 flex items-start gap-3`}
    >
      {/* Faint icon watermark — bottom-right */}
      <div className="absolute -bottom-2 -right-2 opacity-[0.06] pointer-events-none">
        <div className="w-16 h-16">{icon}</div>
      </div>

      {/* Icon badge */}
      <div className={`shrink-0 w-9 h-9 rounded-lg bg-elevated flex items-center justify-center ${textClass}`}>
        <div className="w-5 h-5">{icon}</div>
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-xs text-muted uppercase tracking-wider leading-none mb-1.5">
          {label}
        </p>
        <p className={`text-2xl font-bold leading-none ${textClass}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

const CardStackIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
)

const BoxIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const ChartIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const GlobeIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function DashboardStats({
  totalCards,
  setsTracked,
  completedSets,
  setsAvailable,
}: DashboardStatsProps) {
  const completedColour = completedSets >= 1 ? 'text-price' : 'text-purple-400'
  const completedBorder = completedSets >= 1 ? 'border-l-2 border-l-price' : 'border-l-2 border-l-purple-400'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Cards Owned"
        value={totalCards.toLocaleString()}
        textClass="text-accent"
        borderClass="border-l-2 border-l-accent"
        icon={<CardStackIcon />}
      />
      <StatCard
        label="Sets Tracked"
        value={setsTracked}
        textClass="text-purple-400"
        borderClass="border-l-2 border-l-purple-400"
        icon={<BoxIcon />}
      />
      <StatCard
        label="Sets Complete"
        value={completedSets}
        textClass={completedColour}
        borderClass={completedBorder}
        icon={<ChartIcon />}
      />
      <StatCard
        label="Sets Available"
        value={setsAvailable}
        textClass="text-secondary"
        borderClass="border-l-2 border-l-subtle"
        icon={<GlobeIcon />}
      />
    </div>
  )
}
