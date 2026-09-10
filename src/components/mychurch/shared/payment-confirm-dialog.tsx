'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, CreditCard, ArrowRight } from 'lucide-react'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  amountUsd: number
  loading?: boolean
}

function formatXof(usd: number): string {
  const xof = Math.round(usd * 600)
  return xof.toLocaleString('fr-FR')
}

function formatUsd(usd: number): string {
  return usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  amountUsd,
  loading = false,
}: PaymentConfirmDialogProps) {
  const xofAmount = Math.round(amountUsd * 600)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Montant */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Montant</span>
              <span className="text-lg font-bold">{formatUsd(amountUsd)} $ USD</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Montant à payer</span>
              <span className="text-lg font-bold text-primary">
                {formatXof(amountUsd)} XOF
              </span>
            </div>
          </div>

          {/* Info GeniusPay */}
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Paiement via GeniusPay
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                Le paiement s&apos;effectue en <strong>XOF</strong> (Franc CFA) sur la plateforme GeniusPay.
                Le montant correspond à votre tarif en USD au taux de 1 USD = 600 XOF.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="gap-2">
            {loading ? (
              <>Traitement en cours...</>
            ) : (
              <>
                Confirmer le paiement
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
