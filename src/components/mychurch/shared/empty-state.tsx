'use client'

import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-4 py-10 animate-[fadeIn_0.5s_ease-out] ${className}`}
    >
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-amber-500/10 flex items-center justify-center mb-5">
        <Icon className="h-12 w-12 text-muted-foreground/30" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      {action && (
        <Button
          variant="default"
          size="sm"
          className="mt-5 gap-2"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}