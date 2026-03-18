'use client'

import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export function ShimmerText({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 150, damping: 22 }}
      className={cn('flex items-center gap-4 text-sm text-muted-foreground', className)}
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/70 to-border/70" />
      <div className="text-shimmer whitespace-nowrap">{label}</div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border/70 to-border/70" />
    </motion.div>
  )
}
