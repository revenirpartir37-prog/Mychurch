'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAppStore } from '@/store/app-store'
import { ROLE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { CREATOR } from '@/lib/constants'
import { auth, googleProvider, firebaseAvailable, upsertFirestoreUser } from '@/firebase'
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth'
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
import { Eye, EyeOff, Loader2, ArrowRight, Mail, Lock, Shield } from 'lucide-react'
import type { UserRole } from '@/lib/constants'

const loginFormSchema = z.object({
  churchEmail: z.string().email('Adresse email invalide'),
  role: z.enum(['admin', 'treasurer', 'secretary', 'reader'] as const, {
    message: 'Le rôle est requis',
  }),
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export function LoginPage() {
  const { setAuth, setCurrentView } = useAppStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      churchEmail: '',
      role: undefined,
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Erreur de connexion')
        return
      }

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
      })

      toast.success('Connexion réussie !')
      setCurrentView('dashboard')

      // Firebase sign-in for session persistence (non-blocking)
      if (auth) {
        try {
          await signInWithEmailAndPassword(auth, data.email, data.password)
        } catch {
          // Firebase error should not block the login flow
        }
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setIsGoogleLoading(true)
    try {
      // Get churchEmail and role from the form
      const churchEmail = form.getValues('churchEmail')
      const role = form.getValues('role')

      if (!churchEmail || !role) {
        toast.error("Veuillez remplir l'email de l'église et le rôle avant de vous connecter avec Google.")
        setIsGoogleLoading(false)
        return
      }

      let googleUser: { uid: string; email: string | null; displayName: string | null }

      if (!firebaseAvailable || !auth || !googleProvider) {
        // Fallback for local development if Firebase is not configured
        const emailInput = form.getValues('email')
        if (!emailInput) {
          toast.error("Veuillez saisir votre email dans le formulaire ci-dessous pour tester la connexion Google (mode développement).")
          setIsGoogleLoading(false)
          return
        }
        googleUser = {
          uid: `mock-google-uid-${Date.now()}`,
          email: emailInput,
          displayName: 'Utilisateur Google Démo',
        }
        toast.info("Mode développement: Simulation de la connexion Google...")
      } else {
        const result = await signInWithPopup(auth, googleProvider)
        googleUser = result.user
      }

      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: googleUser.uid,
          email: googleUser.email,
          firstName: (googleUser.displayName || '').split(' ')[0] || 'Google',
          lastName: (googleUser.displayName || '').split(' ').slice(1).join(' ') || 'User',
          churchEmail,
          role,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.needsRegistration) {
          toast.error('Aucun compte trouvé. Veuillez d\'abord vous inscrire.')
        } else {
          toast.error(data.error || 'Erreur de connexion Google')
        }
        return
      }

      setAuth({
        token: data.token,
        refreshToken: data.refreshToken,
        userId: data.user.id,
        churchId: data.church.id,
        email: data.user.email,
        role: data.user.role as UserRole,
        churchName: data.church.name,
        churchLogo: data.church.logo ?? null,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        firebaseUid: googleUser.uid,
        isAuthenticated: true,
        verified: true,
      })

      if (firebaseAvailable && googleUser.uid) {
        upsertFirestoreUser(googleUser.uid, {
          email: googleUser.email || '',
          name: googleUser.displayName || `${data.user.firstName} ${data.user.lastName}` || 'Google User',
          verified: true,
        }).catch((dbErr) => {
          console.warn('Firestore sync failed on Google Login:', dbErr)
        })
      }

      toast.success('Connexion réussie !')
      setCurrentView('dashboard')
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string }
      if (firebaseErr.code === 'auth/popup-closed-by-user') {
        toast.info('Connexion Google annulée')
      } else {
        toast.error('Erreur lors de la connexion Google')
      }
    } finally {
      setIsGoogleLoading(false)
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

      <Card className="w-full max-w-md border-border/50 shadow-xl shadow-primary/5 relative animate-[fadeInUp_0.6s_ease-out]">
        <CardHeader className="text-center space-y-4 pb-2">
          <img
            src="/logo-mychurch.png"
            alt="MYCHURCH Logo"
            className="w-16 h-16 mx-auto object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">MYCHURCH</CardTitle>
            <CardDescription className="mt-1 text-base">Connexion à votre église</CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">{CREATOR}</p>
        </CardHeader>

        <CardContent className="pt-2 space-y-5">
          {/* Google Sign-In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-3 h-11"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Se connecter avec Google {!firebaseAvailable && "(Simulation)"}
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Church Email */}
              <FormField
                control={form.control}
                name="churchEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      Email de l&apos;Église
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="eglise@exemple.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez votre rôle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(
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

              <Separator className="my-2" />

              {/* User Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Votre Email
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

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Mot de passe
                    </FormLabel>
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
                          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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

              {/* Forgot password link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setCurrentView('forgot-password')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <Lock className="h-3 w-3" />
                  Mot de passe oublié?
                </button>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Se connecter
              </Button>

              {/* Register link */}
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-all group text-sm font-medium"
              >
                Créer une église
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </Form>
        </CardContent>
      </Card>

      </div>
  )
}