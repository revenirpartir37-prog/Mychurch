'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Loader2, ArrowLeft, Mail, ShieldCheck, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react'

const forgotFormSchema = z.object({
  email: z.string().email('Adresse email invalide'),
})

const newPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type ForgotFormValues = z.infer<typeof forgotFormSchema>
type NewPasswordFormValues = z.infer<typeof newPasswordSchema>

export function ForgotPasswordPage() {
  const { setCurrentView } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [otpError, setOtpError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: {
      email: '',
    },
  })

  const newPwdForm = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (step === 2) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [step])

  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus()
  }, [])

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setOtpError('')
    if (digit && index < 5) {
      focusInput(index + 1)
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
        focusInput(index - 1)
      } else {
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

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return
    const newOtp = [...otp]
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || ''
    }
    setOtp(newOtp)
    setOtpError('')
    const nextEmpty = newOtp.findIndex((d) => !d)
    focusInput(nextEmpty === -1 ? 5 : nextEmpty)
  }

  async function onSubmit(data: ForgotFormValues) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || "Erreur lors de l'envoi.")
        return
      }

      setSubmittedEmail(data.email)
      setCountdown(60)
      setStep(2)
      toast.success('Un email de réinitialisation a été envoyé.')
    } catch {
      toast.error('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join('')
    if (code.length !== 6) {
      setOtpError('Veuillez entrer le code complet à 6 chiffres.')
      return
    }

    setIsLoading(true)
    setOtpError('')

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, code, purpose: 'password_reset' }),
      })

      const result = await res.json()

      if (!res.ok) {
        setOtpError(result.error || 'Code invalide.')
        return
      }

      setStep(3)
      toast.success('Code vérifié ! Définissez votre nouveau mot de passe.')
    } catch {
      setOtpError('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (countdown > 0) return

    setIsLoading(true)
    setOtpError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail }),
      })

      const result = await res.json()

      if (!res.ok) {
        setOtpError(result.error || "Erreur lors de l'envoi.")
        return
      }

      toast.success('Un nouvel email a été envoyé.')
      setCountdown(60)
      setOtp(Array(6).fill(''))
      focusInput(0)
    } catch {
      setOtpError('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResetPassword(data: NewPasswordFormValues) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, newPassword: data.newPassword }),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Erreur lors de la réinitialisation.')
        return
      }

      setStep(4)
      toast.success('Mot de passe réinitialisé avec succès !')
    } catch {
      toast.error('Erreur de connexion au serveur.')
    } finally {
      setIsLoading(false)
    }
  }

  const isCodeComplete = otp.every((d) => d !== '')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-primary/5 relative animate-[fadeInUp_0.6s_ease-out]">
        <CardHeader className="text-center space-y-4 pb-2">
          <img
            src="/logo-mychurch.png"
            alt="MYCHURCH Logo"
            className="w-16 h-16 mx-auto object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
            {step === 1 && (
              <CardDescription className="mt-1 text-base">
                Entrez votre adresse email pour réinitialiser votre mot de passe.
              </CardDescription>
            )}
            {step === 2 && (
              <CardDescription className="mt-1 text-base">
                Un code a été envoyé. Entrez-le ci-dessous.
              </CardDescription>
            )}
            {step === 3 && (
              <CardDescription className="mt-1 text-base">
                Définissez votre nouveau mot de passe.
              </CardDescription>
            )}
            {step === 4 && (
              <CardDescription className="mt-1 text-base">
                Mot de passe réinitialisé avec succès.
              </CardDescription>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{CREATOR}</p>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Step 1: Email form */}
          {step === 1 && (
            <>
              <div className="flex justify-center mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-7 w-7" />
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          Adresse email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="votre@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Envoyer le code
                  </Button>
                </form>
              </Form>
            </>
          )}

          {/* Step 2: OTP verification */}
          {step === 2 && (
            <>
              <div className="flex justify-center mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-7 w-7" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center mb-4">
                Code envoyé à <span className="font-medium text-foreground">{submittedEmail}</span>
              </p>

              <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-12 h-12 text-center text-2xl font-bold p-0 focus:ring-2 focus:ring-primary"
                    aria-label={`Chiffre ${index + 1}`}
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-sm text-destructive text-center mb-4">{otpError}</p>
              )}

              <Button
                type="button"
                onClick={handleVerifyOtp}
                className="w-full"
                size="lg"
                disabled={isLoading || !isCodeComplete}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vérifier le code
              </Button>

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
            </>
          )}

          {/* Step 3: New password form */}
          {step === 3 && (
            <>
              <div className="flex justify-center mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Lock className="h-7 w-7" />
                </div>
              </div>

              <Form {...newPwdForm}>
                <form onSubmit={newPwdForm.handleSubmit(handleResetPassword)} className="space-y-4">
                  <FormField
                    control={newPwdForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5" />
                          Nouveau mot de passe
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPwd ? 'text' : 'password'}
                              placeholder="••••••••"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPwd(!showNewPwd)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newPwdForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5" />
                          Confirmer le mot de passe
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPwd ? 'text' : 'password'}
                              placeholder="••••••••"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Réinitialiser le mot de passe
                  </Button>
                </form>
              </Form>
            </>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Votre mot de passe a été réinitialisé avec succès. Connectez-vous avec votre nouveau mot de passe.
              </p>
              <Button
                type="button"
                onClick={() => setCurrentView('login')}
                className="w-full"
                size="lg"
              >
                Se connecter
              </Button>
            </div>
          )}

          {/* Back to login link */}
          {step < 4 && (
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
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">{CREATOR}</p>
        </CardContent>
      </Card>
    </div>
  )
}
