'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { CREATOR } from '@/lib/constants'
import { PwaInstallButton } from './shared/pwa-install-button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Church,
  Users,
  DollarSign,
  Calendar,
  ClipboardCheck,
  CreditCard,
  BarChart3,
  Shield,
  Smartphone,
  Cloud,
  ArrowRight,
  Sparkles,
  Star,
  Heart,
  Quote,
  Mail,
  MapPin,
  Globe,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
} from 'lucide-react'

const CONTACT_EMAIL = 'henockaduma2@gmail.com'
const CONTACT_WHATSAPP = '243990601417'
const CONTACT_WHATSAPP_DISPLAY = '+243 990 601 417'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function FadeInSection({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const features = [
  {
    icon: Users,
    title: 'Gestion des Membres',
    description: 'Ajoutez, modifiez et suivez tous vos membres avec des profils détaillés.',
  },
  {
    icon: DollarSign,
    title: 'Gestion Financière',
    description: 'Offrandes, dîmes, dépenses et rapports financiers complets.',
  },
  {
    icon: Calendar,
    title: 'Événements',
    description: 'Planifiez cultes, séminaires et conférences avec calendrier intégré.',
  },
  {
    icon: ClipboardCheck,
    title: 'Présences',
    description: 'Suivez la participation automatiquement lors de chaque événement.',
  },
  {
    icon: CreditCard,
    title: 'Cartes de Membre',
    description: 'Générez des cartes professionnelles avec QR Code personnalisé.',
  },
  {
    icon: BarChart3,
    title: 'Rapports',
    description: 'Statistiques et graphiques détaillés pour mieux décider.',
  },
]

const advantages = [
  {
    step: '01',
    icon: Shield,
    title: 'Sécurité maximale',
    description: 'Chiffrement de bout en bout et contrôle d\'accès granulaire pour protéger vos données sensibles.',
  },
  {
    step: '02',
    icon: Smartphone,
    title: 'Application mobile',
    description: 'Application installable (PWA) sur Android et iPhone pour gérer votre église partout.',
  },
  {
    step: '03',
    icon: Cloud,
    title: 'Multi-église',
    description: 'Gérez plusieurs églises avec une isolation totale des données entre chaque entité.',
  },
]

const testimonials = [
  {
    quote: 'MYCHURCH a transformé la gestion de notre église. Nous avons éliminé tous les registres papier et notre équipe pastorale peut maintenant accéder aux informations en temps réel.',
    name: 'Pasteur Jean-Marc Kabongo',
    church: 'Église Évangélique de la Grâce, Kinshasa',
    stars: 5,
    initials: 'JK',
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    quote: 'La gestion financière est devenue transparente et fiable. Nos membres font confiance au système et les rapports mensuels se génèrent automatiquement. Un gain de temps considérable.',
    name: 'Révérende Marie-Claire Ouedraogo',
    church: 'Assemblée de Dieu, Ouagadougou',
    stars: 5,
    initials: 'MO',
    gradient: 'from-rose-400 to-pink-500',
  },
  {
    quote: 'Le suivi de présence et la gestion des cartes de membre ont professionnelisé notre église. L\'application mobile permet à nos leaders de travailler depuis leur téléphone.',
    name: 'Ancien Samuel Mwamba',
    church: 'Église du Réveil, Lubumbashi',
    stars: 5,
    initials: 'SM',
    gradient: 'from-amber-400 to-orange-500',
  },
]

export function LandingPage() {
  const { setCurrentView } = useAppStore()
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-4 py-20 sm:py-32 lg:py-40 overflow-hidden">
        {/* Animated gradient background */}
        <div className="pointer-events-none absolute inset-0 animate-hero-gradient bg-gradient-to-br from-primary/10 via-background to-primary/5" />

        {/* Grid pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating gradient blobs */}
        <div className="pointer-events-none absolute top-16 left-[5%] h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-500/20 blur-3xl animate-float1" />
        <div className="pointer-events-none absolute top-32 right-[5%] h-80 w-80 rounded-full bg-gradient-to-br from-rose-500/25 to-pink-500/15 blur-3xl animate-float2" />
        <div className="pointer-events-none absolute bottom-12 left-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-amber-400/25 to-orange-500/15 blur-3xl animate-float3" />

        <FadeInSection className="relative flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Logo with pulse glow */}
          <img
            src="/logo-mychurch.png"
            alt="MYCHURCH Logo"
            className="w-28 h-28 sm:w-32 sm:h-32 mb-6 object-contain animate-pulse-glow"
          />

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-4">
            MYCHURCH
          </h1>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-primary font-semibold mb-4">
            La plateforme moderne de gestion d&apos;église
          </p>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mb-8 leading-relaxed">
            Remplacez les cahiers papier, registres physiques et fichiers Excel par une solution
            centralisée, sécurisée et professionnelle.
          </p>

          {/* CTA Buttons with hover scale effect */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <Button
              size="lg"
              onClick={() => setCurrentView('register')}
              className="gap-2 text-base px-8 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
            >
              <Sparkles className="h-5 w-5" />
              Commencer gratuitement
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentView('login')}
              className="gap-2 text-base px-8 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/10"
            >
              Se connecter
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* PWA Install */}
          <PwaInstallButton />
        </FadeInSection>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto">
          <FadeInSection className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Tout ce dont votre église a besoin
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Une suite complète d&apos;outils conçus spécifiquement pour la gestion ecclésiastique moderne.
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const stepNum = String(index + 1).padStart(2, '0')
              return (
                <FadeInSection key={feature.title} delay={index * 0.1}>
                  {/* Glowing gradient border wrapper */}
                  <div className="rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 p-px group">
                    <Card className="relative h-full bg-card/95 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 overflow-hidden border-0">
                      {/* Left accent line */}
                      <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-gradient-to-b from-primary to-primary/30" />

                      {/* Step number indicator */}
                      <span className="absolute top-3 right-4 text-5xl font-black text-primary/[0.06] leading-none select-none">
                        {stepNum}
                      </span>

                      <CardHeader className="pb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-3 transition-all duration-300 group-hover:bg-primary/20 group-hover:translate-y-[-2px]">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-sm leading-relaxed">
                          {feature.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </div>
                </FadeInSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* Advantages Section - diagonal dot pattern */}
      <section className="relative px-4 py-16 sm:py-24 bg-muted/30 overflow-hidden">
        {/* Diagonal dot pattern background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            transform: 'rotate(-15deg)',
            transformOrigin: 'center',
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          <FadeInSection className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Pourquoi choisir MYCHURCH ?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Une plateforme pensée pour la sécurité, l&apos;accessibilité et la performance.
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {advantages.map((item, index) => {
              const Icon = item.icon
              return (
                <FadeInSection key={item.title} delay={index * 0.15}>
                  <Card className="group h-full border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30">
                    <CardHeader className="text-center relative">
                      {/* Step indicator */}
                      <span className="absolute top-0 right-0 text-6xl font-black text-primary/5 leading-none select-none">
                        {item.step}
                      </span>
                      {/* Rotating gradient circle on hover */}
                      <div className="relative flex h-16 w-16 items-center justify-center mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/0 via-primary/20 to-primary/0 transition-all duration-500 group-hover:from-primary/20 group-hover:via-primary/40 group-hover:to-primary/20 group-hover:animate-rotate-gradient" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-card">
                          <Icon className="h-7 w-7 text-primary" />
                        </div>
                      </div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </FadeInSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-4 py-16 sm:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <FadeInSection className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Ce que disent nos églises
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Des églises font confiance à MYCHURCH pour leur gestion quotidienne.
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <FadeInSection key={testimonial.name} delay={index * 0.12}>
                <Card className="h-full border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      {/* Decorative quote icon */}
                      <Quote className="h-8 w-8 text-primary/15" />
                      {/* Star rating */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < testimonial.stars
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm leading-relaxed text-foreground/80 mb-4">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="border-t border-border/50 pt-4 flex items-center gap-3">
                      {/* Avatar with gradient */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${testimonial.gradient} text-white text-sm font-bold shrink-0`}>
                        {testimonial.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{testimonial.church}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-16 sm:py-24 overflow-hidden">
        {/* Full-width gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />

        {/* Subtle pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <FadeInSection>
            <Church className="h-12 w-12 text-primary-foreground/60 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
              Prêt à moderniser votre église ?
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8 leading-relaxed">
              Rejoignez les églises qui ont déjà transformé leur gestion. Commencez
              gratuitement, sans carte bancaire.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setCurrentView('register')}
                className="gap-2 text-base px-8 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <Sparkles className="h-5 w-5" />
                Commencer gratuitement
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setCurrentView('about')}
                className="gap-2 text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all duration-300 hover:scale-105"
              >
                <Mail className="h-4 w-4" />
                Contacter nous
              </Button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className="mt-auto bg-card/80 relative">
        {/* Gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* À propos */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">À propos</h3>
              <ul className="space-y-2.5">
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Notre mission
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Fonctionnalités
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Tarifs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mises à jour
                  </button>
                </li>
              </ul>
            </div>

            {/* Liens */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Liens</h3>
              <ul className="space-y-2.5">
                <li>
                  <button
                    onClick={() => setCurrentView('login')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Se connecter
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('register')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Créer un compte
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Documentation
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setCurrentView('about')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Contact</h3>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Contact MYCHURCH')}&body=${encodeURIComponent('Bonjour Henock, je vous contacte au sujet de MYCHURCH.')}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                    title={`Envoyer un email à ${CONTACT_EMAIL}`}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 group-hover:text-primary transition-colors" />
                    <span className="break-all">{CONTACT_EMAIL}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Bonjour Henock, je vous contacte au sujet de MYCHURCH.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                    title="Discuter sur WhatsApp"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 shrink-0 group-hover:text-emerald-500 transition-colors" />
                    <span>{CONTACT_WHATSAPP_DISPLAY}</span>
                  </a>
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>RDC, Kinshasa</span>
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span>www.mychurch.app</span>
                </li>
              </ul>
            </div>

            {/* Légal */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Légal</h3>
              <ul className="space-y-2.5">
                <li>
                  <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Conditions d&apos;utilisation
                  </button>
                </li>
                <li>
                  <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Politique de confidentialité
                  </button>
                </li>
                <li>
                  <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Mentions légales
                  </button>
                </li>
                <li>
                  <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Sécurité des données
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Bottom footer bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Church className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">MYCHURCH</span>
              <span className="text-sm text-muted-foreground">© {currentYear}</span>
            </div>

            {/* Creator credit - prominent with heart */}
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {CREATOR}
              <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            </div>

            {/* Social media icons with hover effects */}
            <div className="flex items-center gap-3">
              <button className="h-9 w-9 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:scale-110 transition-all duration-200" aria-label="Facebook">
                <Facebook className="h-4 w-4" />
              </button>
              <button className="h-9 w-9 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:scale-110 transition-all duration-200" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </button>
              <button className="h-9 w-9 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 hover:scale-110 transition-all duration-200" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </button>
              <button className="h-9 w-9 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:scale-110 transition-all duration-200" aria-label="YouTube">
                <Youtube className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}