import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Heart, MessageCircle, Plus, Sparkles, UserRound } from 'lucide-react'
import './BeautifulOnboarding.css'

type OnboardingSlide = {
  title: string
  description: string
  images: [string, string]
  imageLabels: [string, string]
  postText: string
}

const slides: OnboardingSlide[] = [
  {
    title: 'Connect Together',
    description: 'A closer circle, wherever life takes you.',
    images: ['/onboarding/1.jpeg', '/onboarding/4.jpeg'],
    imageLabels: ['Your profile', 'Your people'],
    postText: 'Good people make every moment brighter.',
  },
  {
    title: 'Share Moments',
    description: 'The little things deserve to be remembered.',
    images: ['/onboarding/5.jpeg', '/onboarding/3.jpeg'],
    imageLabels: ['A day to remember', 'A moment shared'],
    postText: 'Today feels like a story worth sharing.',
  },
  {
    title: 'Forever Free',
    description: 'Your community, without a subscription.',
    images: ['/onboarding/6.jpeg', '/onboarding/2.jpeg'],
    imageLabels: ['Made for your circle', 'Nagesh Social'],
    postText: 'Your space. Your people. Always free.',
  },
]

const goldenLights = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 43 + 7) % 100}%`,
  top: `${(index * 67 + 9) % 100}%`,
  size: `${index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 2}px`,
  delay: `${(index % 9) * -0.7}s`,
}))

type BeautifulOnboardingProps = {
  onComplete: () => void
}

function PhoneMockup({
  image,
  label,
  postText,
  side,
  reducedMotion,
}: {
  image: string
  label: string
  postText: string
  side: 'back' | 'front'
  reducedMotion: boolean | null
}) {
  return (
    <motion.div
      className={`onboarding-phone onboarding-phone--${side}`}
      animate={reducedMotion ? undefined : { y: side === 'front' ? [0, -9, 0] : [0, 8, 0] }}
      transition={reducedMotion ? undefined : { duration: side === 'front' ? 4.4 : 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="onboarding-phone__screen">
        <img src={image} alt={label} />
        <div className="onboarding-phone__shade" />
        <div className="onboarding-phone__status" aria-hidden="true"><span>9:41</span><span>● ● ▰</span></div>
        <div className="onboarding-phone__notch" aria-hidden="true" />
        <div className="onboarding-phone__post">
          <div className="onboarding-phone__profile">
            <span className="onboarding-phone__avatar">N</span>
            <span><strong>Nagesh Social</strong><small>{label}</small></span>
            <Sparkles size={15} aria-hidden="true" />
          </div>
          <p>{postText}</p>
          <div className="onboarding-phone__actions" aria-hidden="true">
            <span><Heart size={13} /> 128</span>
            <span><MessageCircle size={13} /> 24</span>
            <span><Plus size={14} /></span>
          </div>
        </div>
        <div className="onboarding-phone__home" aria-hidden="true" />
      </div>
    </motion.div>
  )
}

export default function BeautifulOnboarding({ onComplete }: BeautifulOnboardingProps) {
  const [activeSlide, setActiveSlide] = useState(0)
  const reducedMotion = useReducedMotion()
  const slide = slides[activeSlide]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, 2000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="beautiful-onboarding" aria-label="Nagesh Social welcome">
      <div className="onboarding-atmosphere" aria-hidden="true">
        <div className="onboarding-atmosphere__glow onboarding-atmosphere__glow--left" />
        <div className="onboarding-atmosphere__glow onboarding-atmosphere__glow--right" />
        {goldenLights.map((light, index) => (
          <span
            className={`onboarding-light${index % 4 === 0 ? ' onboarding-light--soft' : ''}`}
            key={index}
            style={{ left: light.left, top: light.top, width: light.size, height: light.size, animationDelay: light.delay }}
          />
        ))}
      </div>

      <header className="onboarding-header">
        <div className="onboarding-brand">
          <span className="onboarding-brand__seal" aria-hidden="true">N</span>
          <span className="onboarding-brand__name">Nagesh Social <i>- Lifetime Free</i></span>
        </div>
        <button className="onboarding-skip" type="button" onClick={onComplete}>Skip <ArrowRight size={15} /></button>
      </header>

      <section className="onboarding-content" aria-live="polite">
        <div className="onboarding-copy">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="onboarding-copy__slide"
              key={slide.title}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: 'blur(4px)' }}
              transition={{ duration: reducedMotion ? 0.15 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="onboarding-eyebrow"><span /> YOUR CIRCLE, YOUR WAY</div>
              <h1>{slide.title}</h1>
              <p>{slide.description}</p>
              <div className="onboarding-copy__rule"><span /> <span /> <span /></div>
            </motion.div>
          </AnimatePresence>

          <div className="onboarding-progress" aria-label={`Slide ${activeSlide + 1} of ${slides.length}`}>
            <span className="onboarding-progress__count">0{activeSlide + 1}</span>
            <div className="onboarding-progress__track" aria-hidden="true">
              {slides.map((item, index) => (
                <button
                  className={`onboarding-dot${index === activeSlide ? ' is-active' : ''}`}
                  key={item.title}
                  type="button"
                  aria-label={`Show ${item.title}`}
                  aria-current={index === activeSlide ? 'step' : undefined}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
            <span className="onboarding-progress__count onboarding-progress__count--muted">0{slides.length}</span>
          </div>

          <button className="onboarding-start" type="button" onClick={onComplete}>
            <span>Get Started</span><ArrowRight size={19} />
          </button>
          <p className="onboarding-footnote"><Sparkles size={13} /> A little more connected. Always free.</p>
        </div>

        <div className="onboarding-stage" aria-label="App preview">
          <div className="onboarding-stage__halo" aria-hidden="true" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="onboarding-stage__phones"
              key={slide.title}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: reducedMotion ? 0.15 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhoneMockup image={slide.images[0]} label={slide.imageLabels[0]} postText={slide.postText} side="back" reducedMotion={reducedMotion} />
              <PhoneMockup image={slide.images[1]} label={slide.imageLabels[1]} postText={slide.postText} side="front" reducedMotion={reducedMotion} />
            </motion.div>
          </AnimatePresence>
          <span className="onboarding-stage__caption"><span /> MADE FOR YOUR MOMENTS</span>
        </div>
      </section>

      <footer className="onboarding-footer">
        <span>EST. FOR CONNECTION</span>
        <span className="onboarding-footer__line" />
        <span>01 — 03</span>
      </footer>
    </main>
  )
}