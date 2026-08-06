'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAppStore } from '@/store/app-store'
import { CURRENCY_LABELS, CREATOR } from '@/lib/constants'
import { toast } from 'sonner'
import { upsertFirestoreUser, auth as firebaseAuth, firebaseAvailable } from '@/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Check, User, Building2, CheckCircle2 } from 'lucide-react'
import type { Currency, UserRole } from '@/lib/constants'

// --- Schemas ---

const adminSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().default(''),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

const churchSchema = z.object({
  churchName: z.string().min(1, 'Le nom de l\'église est requis'),
  churchEmail: z.string().email('Adresse email de l\'église invalide'),
  address: z.string().min(1, 'L\'adresse est requise'),
  city: z.string().min(1, 'La ville est requise'),
  province: z.string().min(1, 'La province est requise'),
  country: z.string().min(1, 'Le pays est requis'),
  currency: z.enum(['USD', 'FC', 'EUR'] as const, {
    message: 'La devise est requise',
  }),
  initialCapital: z.coerce.number().min(0, 'Le capital initial doit être positif').optional().transform(v => v ?? 0),
})

type AdminFormValues = z.infer<typeof adminSchema>
type ChurchFormValues = z.infer<typeof churchSchema>

const STEPS = [
  { number: 1, label: 'Administrateur', icon: User },
  { number: 2, label: 'Église', icon: Building2 },
  { number: 3, label: 'Confirmation', icon: CheckCircle2 },
]

export function RegisterPage() {
  const { setCurrentView, setAuth } = useAppStore()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1 form
  const adminForm = useForm<AdminFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adminSchema) as any,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Step 2 form
  const churchForm = useForm<ChurchFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(churchSchema) as any,
    defaultValues: {
      churchName: '',
      churchEmail: '',
      address: '',
      city: '',
      province: '',
      country: '',
      currency: 'USD',
      initialCapital: 0,
    },
  })

  const progressValue = ((step - 1) / (STEPS.length - 1)) * 100

  function handleNextStep1() {
    const result = adminForm.formState.isValid
    if (!adminForm.formState.isValid) {
      adminForm.trigger().then((valid) => {
        if (valid) setStep(2)
      })
    } else {
      setStep(2)
    }
  }

  function handleNextStep2() {
    churchForm.trigger().then((valid) => {
      if (valid) setStep(3)
    })
  }

  async function handleRegister() {
    const admin = adminForm.getValues()
    const church = churchForm.getValues()

    setIsLoading(true)
    try {
      // 1. Create Firebase Auth user (non-blocking, for session management)
      let firebaseUid: string | undefined
      if (firebaseAvailable && firebaseAuth) {
        try {
          const fbCredential = await createUserWithEmailAndPassword(
            firebaseAuth,
            admin.email,
            admin.password
          )
          firebaseUid = fbCredential.user.uid
        } catch (fbErr: unknown) {
          // If Firebase account already exists, continue without it
          const fbError = fbErr as { code?: string }
          if (fbError.code !== 'auth/email-already-in-use') {
            console.warn('Firebase user creation failed (non-blocking):', fbErr)
          }
        }
      }

      // 2. Register in the app database
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone || undefined,
          password: admin.password,
          churchName: church.churchName,
          churchEmail: church.churchEmail,
          address: church.address,
          city: church.city,
          province: church.province,
          country: church.country,
          currency: church.currency,
          initialCapital: Number(church.initialCapital || 0),
          firebaseUid,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (result.details && Array.isArray(result.details)) {
          const detailMsgs = result.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(' | ')
          toast.error(`Validation échouée: ${detailMsgs}`)
        } else {
          toast.error(result.error || 'Erreur lors de l\'inscription')
        }
        return
      }

      // 3. Sync user to Firestore (run in background to avoid blocking if offline)
      const uid = firebaseUid || result.user.id
      upsertFirestoreUser(uid, {
        email: admin.email,
        name: `${admin.firstName} ${admin.lastName}`,
        verified: true,
      }).catch((dbErr) => {
        console.warn('Firestore sync failed on registration:', dbErr)
      })

      setAuth({
        token: result.token,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        churchId: result.church.id,
        email: result.user.email,
        role: result.user.role,
        churchName: result.church.name,
        churchLogo: result.church.logo ?? null,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        verified: true,
        firebaseUid: uid,
      })
      toast.success(`Bienvenue ! Votre église "${result.church.name}" a été créée avec succès.`)
      setCurrentView('dashboard')
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setIsLoading(false)
    }
  }

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
      <Card className="w-full max-w-lg border-border/50 shadow-xl shadow-primary/5 relative animate-[fadeInUp_0.6s_ease-out]">
        <CardHeader className="text-center space-y-3 pb-2">
          <img
            src="/logo-mychurch.png"
            alt="MYCHURCH Logo"
            className="w-14 h-14 mx-auto object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-bold">MYCHURCH</CardTitle>
            <CardDescription className="mt-1">Créer votre église</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Progress Bar with gradient */}
          <div className="mb-6">
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {STEPS.map((s) => {
                const Icon = s.icon
                const isActive = step === s.number
                const isCompleted = step > s.number
                const isStep3Completed = s.number === 3 && step === 3
                return (
                  <div
                    key={s.number}
                    className={`flex flex-col items-center gap-1.5 transition-colors ${
                      step >= s.number
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                        isCompleted || isStep3Completed
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : isActive
                            ? 'bg-primary/15 text-primary border-2 border-primary/40'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : isStep3Completed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="hidden sm:inline text-xs font-medium">{s.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step 1: Admin Info */}
          {step === 1 && (
            <Form {...adminForm}>
              <form className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </span>
                  Informations Administrateur
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={adminForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Henock" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Aduma" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={adminForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@eglise.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adminForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone (optionnel)</FormLabel>
                      <FormControl>
                        <Input placeholder="+243 000 000 000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adminForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Masquer' : 'Afficher'}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={adminForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                          >
                            {showConfirm ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}

          {/* Step 2: Church Info */}
          {step === 2 && (
            <Form {...churchForm}>
              <form className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  Informations Église
                </div>

                <FormField
                  control={churchForm.control}
                  name="churchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l&apos;Église</FormLabel>
                      <FormControl>
                        <Input placeholder="Église de la Grâce" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={churchForm.control}
                  name="churchEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de l&apos;Église</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="eglise@exemple.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={churchForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Rue de la Paix" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={churchForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Kinshasa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={churchForm.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province</FormLabel>
                        <FormControl>
                          <Input placeholder="Kinshasa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={churchForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pays</FormLabel>
                      <FormControl>
                        <Input placeholder="République Démocratique du Congo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={churchForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(Object.entries(CURRENCY_LABELS) as [Currency, string][]).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={churchForm.control}
                    name="initialCapital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capital initial</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                Confirmation
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Résumé de l&apos;inscription</h4>
                <Separator />
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Administrateur</span>
                    <span className="font-medium text-foreground">
                      {adminForm.getValues().firstName} {adminForm.getValues().lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">
                      {adminForm.getValues().email}
                    </span>
                  </div>
                  {adminForm.getValues().phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Téléphone</span>
                      <span className="font-medium text-foreground">
                        {adminForm.getValues().phone}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Église</span>
                    <span className="font-medium text-foreground">
                      {churchForm.getValues().churchName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email Église</span>
                    <span className="font-medium text-foreground">
                      {churchForm.getValues().churchEmail}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adresse</span>
                    <span className="font-medium text-foreground text-right max-w-[60%]">
                      {churchForm.getValues().address}, {churchForm.getValues().city},{' '}
                      {churchForm.getValues().province}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pays</span>
                    <span className="font-medium text-foreground">
                      {churchForm.getValues().country}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Devise</span>
                    <span className="font-medium text-foreground">
                      {CURRENCY_LABELS[churchForm.getValues().currency]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital initial</span>
                    <span className="font-medium text-foreground">
                      {churchForm.getValues().initialCapital} {churchForm.getValues().currency}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Un essai gratuit de 30 jours sera activé automatiquement.
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6 gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Retour</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentView('login')}
                className="gap-2 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Connexion</span>
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                onClick={step === 1 ? handleNextStep1 : handleNextStep2}
                className="gap-2"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleRegister}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer mon église
              </Button>
            )}
          </div>

          {/* Login link - always visible at bottom */}
          <p className="text-center text-sm text-muted-foreground mt-4">
            Déjà inscrit ?{' '}
            <button
              type="button"
              onClick={() => setCurrentView('login')}
              className="text-primary hover:underline font-medium"
            >
              Se connecter
            </button>
          </p>

          {/* Footer credit */}
          <p className="text-center text-xs text-muted-foreground mt-4">{CREATOR}</p>
        </CardContent>
      </Card>

      </div>
  )
}