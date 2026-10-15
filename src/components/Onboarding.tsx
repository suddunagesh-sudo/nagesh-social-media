import { motion, useReducedMotion } from 'motion/react'
import './Onboarding.css'

const photos = Array.from({ length: 6 }, (_, index) => ({
  className: `orb orb${index + 1}`,
  image: `/onboarding/${index + 1}.jpeg`,
}))

const starColors = ['#ffd66b', '#83dfff', '#ffffff', '#c5a2ff'] as const
const stars = Array.from({ length: 30 }, (_, index) => {
  const seed = index + 1
  const random = (value: number) => {
    const number = Math.sin(seed * value * 127.1) * 43758.5453
    return number - Math.floor(number)
  }

  return {
    left: `${random(1) * 100}%`,
    top: `${random(2) * 100}%`,
    size: 2 + Math.floor(random(3) * 5),
    color: starColors[index % starColors.length],
    duration: 3 + random(4) * 4,
    delay: random(5) * -6,
  }
})

type OnboardingProps = {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const reducedMotion = useReducedMotion()

  return (
    <main className="hero-container" aria-label="Nagesh Social में आपका स्वागत है">
      <img className="main-bg" src="/onboarding/hero.jpeg" alt="" style={{ objectFit: 'contain' }} />

      <div className="hero-stars" aria-hidden="true">
        {stars.map((star, index) => (
          <motion.span
            className="hero-star"
            key={index}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              color: star.color,
              backgroundColor: star.color,
            }}
            animate={reducedMotion ? undefined : { opacity: [0.2, 1, 0.2], y: [0, -36, 0] }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <h1 className="hero-welcome">Nagesh Social में आपका स्वागत है</h1>

      <div
        className="srishti"
        aria-hidden="true"
        style={{ animation: reducedMotion ? 'none' : 'spin 6s linear infinite' }}
      >
        <div className="earth" />
        <div className="light" />
      </div>

      <div
        className="orbits"
        aria-label="Nagesh Social की तस्वीरें"
        style={{ animation: reducedMotion ? 'none' : 'rot 28s linear infinite' }}
      >
        {photos.map((photo) => (
          <div
            className={photo.className}
            key={photo.image}
            role="img"
            aria-label={`समुदाय की तस्वीर ${photo.image}`}
            style={{ backgroundImage: `url("${photo.image}")` }}
          />
        ))}
      </div>

      <div className="hero-entry">
        <button className="hero-entry__button" type="button" onClick={onComplete}>
          सृष्टि में प्रवेश करें
        </button>
      </div>
    </main>
  )
}
