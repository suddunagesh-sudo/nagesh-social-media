import { useEffect, useRef } from 'react'

const adClient = import.meta.env.VITE_ADSENSE_CLIENT || ''
const adSlots = {
  feed: import.meta.env.VITE_ADSENSE_FEED_SLOT || '',
  sidebar: import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT || '',
  infeed: import.meta.env.VITE_ADSENSE_INFEED_SLOT || '',
}

export default function AdBanner({ title = 'Sponsored', className = '', placement = 'feed' }) {
  const ref = useRef(null)
  const slot = adSlots[placement] || ''
  const configured = /^ca-pub-\d+$/.test(adClient) && /^\d+$/.test(slot)

  useEffect(() => {
    if (!configured || !ref.current) return

    const adElement = ref.current.querySelector('ins.adsbygoogle')
    if (!adElement) return

    let pushed = false
    const pushAd = () => {
      if (pushed || adElement.getBoundingClientRect().width <= 0) return

      const script = document.getElementById('adsbygoogle-script')
      if (!script || script.dataset.loaded !== 'true') return

      pushed = true
      window.adsbygoogle = window.adsbygoogle || []
      try {
        window.adsbygoogle.push({})
      } catch {
        pushed = false
      }
    }

    let script = document.getElementById('adsbygoogle-script')
    if (!script) {
      script = document.createElement('script')
      script.id = 'adsbygoogle-script'
      script.async = true
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
      script.crossOrigin = 'anonymous'
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true'
        pushAd()
      }, { once: true })
      document.head.appendChild(script)
    } else if (script.dataset.loaded === 'true') {
      pushAd()
    } else {
      script.addEventListener('load', pushAd, { once: true })
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(pushAd)
    observer?.observe(ref.current)
    pushAd()

    return () => observer?.disconnect()
  }, [configured, slot])

  return (
    <div ref={ref} className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_rgba(31,41,55,0.035)] ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
        <span>{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Ad</span>
      </div>
      <div className="p-3 sm:p-4">
        {configured ? (
          <div className="min-h-[120px] overflow-hidden rounded-xl border border-slate-200 bg-white">
            <ins
              className="adsbygoogle"
              style={{ display: 'block', minHeight: '120px', width: '100%' }}
              data-ad-client={adClient}
              data-ad-slot={slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs text-slate-500">
            Web ad placement is not configured.
          </div>
        )}
      </div>
    </div>
  )
}
