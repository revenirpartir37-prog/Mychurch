'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { CREATOR } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'
import type { UserRole } from '@/lib/constants'
import { upsertFirestoreUser, deleteFirestoreOtp } from '@/firebase'
import { onesignalLogin } from '@/components/mychurch/shared/onesignal-provider'

export function OtpPage() {
  const { pendingOtpEmail, setCurrentView, setAuth } = useAppStore()
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus()
  }, [])

  function handleChange(index: number, value: string) {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')

    // Auto-focus next input
    if (digit && index < 5) {
      focusInput(index + 1)
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current input is empty, go back to previous
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
        focusInput(index - 1)
      } else {
        // Clear current input
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusInput(index + 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return

    const newOtp = [...otp]
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || ''
    }
    setOtp(newOtp)
    setError('')

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex((d) => !d)
    focusInput(nextEmpty === -1 ? 5 : nextEmpty)
  }

  async function handleVerify() {
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Veuillez entrer le code complet à 6 chiffres.')
      return
    }
    if (!pendingOtpEmail) {
      setError('Aucun email trouvé. Veuillez recommencer.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingOtpEmail, code }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Code OTP invalide.')
        return
      }

      // Clean up Firestore OTP (run in background)
      deleteFirestoreOtp(pendingOtpEmail).catch((dbErr) => {
        console.warn('Firestore OTP delete failed:', dbErr)
      })

      // If the API returned tokens for direct login, go straight to dashboard
      if (result.directLogin && result.token && result.user && result.church) {
        // Update Firestore user as verified (run in background)
        upsertFirestoreUser(result.user.firebaseUid || result.user.id, {
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`,
          verified: true,
        }).catch((dbErr) => {
          console.warn('Firestore sync failed on OTP verify:', dbErr)
        })

        setAuth({
          token: result.token,
          refreshToken: result.refreshToken,
          userId: result.user.id,
          churchId: result.church.id,
          email: result.user.email,
          role: result.user.role as UserRole,
          churchName: result.church.name,
          churchLogo: result.church.logo ?? null,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          isAuthenticated: true,
          verified: true,
        })
        onesignalLogin(result.user.id)
        toast.success('Email vérifié ! Bienvenue sur votre dashboard 🎉')
        setCurrentView('dashboard')
      } else {
        // Fallback: redirect to login
        setAuth({ verified: true })
        toast.success('Email vérifié ! Connectez-vous maintenant.')
        setCurrentView('login')
      }
    } catch {
      setError('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!pendingOtpEmail || countdown > 0) return

    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingOtpEmail }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || "Erreur lors de l'envoi du code.")
        return
      }

      toast.success('Un nouveau code a été envoyé.')
      setCountdown(60)
      setOtp(Array(6).fill(''))
      focusInput(0)
    } catch {
      setError('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  const isCodeComplete = otp.every((d) => d !== '')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Subtle dot pattern background */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />

      {/* Fade-in animated card */}
      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-primary/5 relative animate-[fadeInUp_0.6s_ease-out]">
        <CardHeader className="text-center space-y-4 pb-2">
          <img
            src="/logo-mychurch.png"
            alt="MYCHURCH Logo"
            className="w-16 h-16 mx-auto object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-bold">Vérification OTP</CardTitle>
            <CardDescription className="mt-1 text-base">
              Entrez le code à 6 chiffres envoyé à{' '}
              <span className="font-medium text-foreground">{pendingOtpEmail || 'votre email'}</span>
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">{CREATOR}</p>
        </CardHeader>

        <CardContent className="pt-4">
          {/* OTP Icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>

          {/* Info banner */}
          <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-center text-primary">
            📧 Vérifiez votre boîte mail — le code expire dans <strong>10 minutes</strong>.
          </div>

          {/* 6-digit OTP inputs */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-6">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-2xl font-bold p-0 focus:ring-2 focus:ring-primary"
                aria-label={`Chiffre ${index + 1}`}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive text-center mb-4">{error}</p>
          )}

          {/* Verify button */}
          <Button
            type="button"
            onClick={handleVerify}
            className="w-full"
            size="lg"
            disabled={isLoading || !isCodeComplete}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vérifier et accéder au dashboard
          </Button>

          {/* Resend code */}
          <div className="text-center mt-4">
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Renvoyer le code dans <span className="font-medium text-foreground">{countdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm text-primary hover:underline font-medium disabled:opacity-50"
              >
                Renvoyer le code
              </button>
            )}
          </div>

          {/* Back to login */}
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setCurrentView('login')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </button>
          </div>

          {/* Footer credit */}
          <p className="text-center text-xs text-muted-foreground mt-4">{CREATOR}</p>
        </CardContent>
      </Card>

      </div>
  )
}