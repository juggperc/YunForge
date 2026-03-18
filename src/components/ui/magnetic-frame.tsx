'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

export function MagneticFrame({
  children,
  className,
  strength = 14,
  disabled = false,
}: {
  children: ReactNode
  className?: string
  strength?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, {
    stiffness: 180,
    damping: 20,
    mass: 0.25,
  })
  const y = useSpring(rawY, {
    stiffness: 180,
    damping: 20,
    mass: 0.25,
  })

  if (disabled || reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      onMouseMove={(event) => {
        if (!ref.current) {
          return
        }

        const bounds = ref.current.getBoundingClientRect()
        const offsetX = event.clientX - (bounds.left + bounds.width / 2)
        const offsetY = event.clientY - (bounds.top + bounds.height / 2)

        rawX.set(Math.max(Math.min(offsetX * 0.16, strength), -strength))
        rawY.set(Math.max(Math.min(offsetY * 0.16, strength), -strength))
      }}
      onMouseLeave={() => {
        rawX.set(0)
        rawY.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}
