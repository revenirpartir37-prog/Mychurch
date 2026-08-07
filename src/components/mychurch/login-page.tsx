'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAppStore } from '@/store/app-store'
import { ROLE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { CREATOR } from '@/lib/constants'
import { auth } from '@/firebase'
import { onesignalLogin } from '@/components/mychurch/shared/onesignal-provider'
import { signInWithEmailAndPassword } from 'firebase/auth'
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

      // Associe l'utilisateur à OneSignal pour les push ciblées (id Supabase)
      onesignalLogin(result.user.id)

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