import { ArrowUpRight, Sparkles } from 'lucide-react'

export default function SponsoredAd({ className = '' }: { className?: string }) {
  return (
    <article className={`overflow-hidden rounded-xl border border-amber-300 bg-[#101d35] shadow-[0_8px_28px_rgba(12,25,47,0.14)] ${className}`}>
      <div className="flex items-center justify-between border-b border-amber-200/15 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-amber-100">
          <Sparkles size={14} className="text-amber-300" /> Sponsored by Nagesh
        </span>
        <span className="rounded-full border border-amber-200/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100/75">Ad</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_112px] items-stretch">
        <div className="flex min-w-0 flex-col items-start justify-center p-4 sm:p-5">
          <p className="text-xs font-semibold text-amber-200">A community that feels like yours</p>
          <h2 className="mt-2 text-lg font-bold leading-tight text-white">Nagesh Social</h2>
          <p className="mt-1 text-xs font-medium text-amber-100/75">Lifetime Free</p>
          <a
            href="https://nagesh.social"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-500 px-3 text-xs font-bold text-slate-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Explore the community <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="relative min-h-[172px] overflow-hidden border-l border-amber-200/20">
          <img
            src="/onboarding/1.jpeg"
            alt="Nagesh wearing his red cap"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101d35]/35 via-transparent to-transparent" />
        </div>
      </div>
    </article>
  )
}