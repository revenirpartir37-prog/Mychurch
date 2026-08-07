/**
 * Script de test pour l'envoi d'emails via Resend
 * Usage: node scripts/test-email.mjs <email_destinataire>
 *
 * Ce script simule exactement l'envoi d'un OTP de vérification
 * comme le fait l'API /api/auth/register en production.
 */

import { Resend } from 'resend'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Charger les variables d'environnement depuis .env
function loadEnv() {
  const envPath = resolve(__dirname, '../.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    process.env[key] = val
  }
}

loadEnv()

// Vérifier la clé API
const RESEND_API_KEY = process.env.RESEND_API_KEY
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY manquant dans .env')
  process.exit(1)
}

// Email de destination (argument CLI ou valeur par défaut)
const TO_EMAIL = process.argv[2]
if (!TO_EMAIL || !TO_EMAIL.includes('@')) {
  console.error('❌ Veuillez fournir une adresse email valide en argument.')
  console.error('   Usage: node scripts/test-email.mjs votre@email.com')
  process.exit(1)
}

// Générer un code OTP de test
const OTP_CODE = Math.floor(100000 + Math.random() * 900000).toString()
const CHURCH_NAME = 'Église Test MYCHURCH'

// Template HTML identique à celui utilisé en production
const html = `
<div style="max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">MYCHURCH</h1>
    <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">Code de vérification OTP</p>
  </div>
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">Bonjour,</p>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Votre code de vérification pour l'église <strong style="color: #1f2937;">${CHURCH_NAME}</strong> est :
    </p>
    <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
      <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af;">${OTP_CODE}</span>
    </div>
    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
      Ce code expire dans <strong style="color: #dc2626;">10 minutes</strong>. Ne le partagez avec personne.
    </p>
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
        Si vous n'avez pas demandé ce code, ignorez cet email.
      </p>
    </div>
  </div>
  <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
    <p style="margin: 0; color: #9ca3af; font-size: 11px;">
      &copy; ${new Date().getFullYear()} MYCHURCH. Created by Henock Aduma.
    </p>
  </div>
</div>
`

async function sendTestEmail() {
  console.log('\n🚀 MYCHURCH – Test d\'envoi d\'email via Resend')
  console.log('─────────────────────────────────────────────')
  console.log(`📧 Destinataire  : ${TO_EMAIL}`)
  console.log(`🔑 Clé API       : ${RESEND_API_KEY.slice(0, 8)}...${RESEND_API_KEY.slice(-4)}`)
  console.log(`🔢 Code OTP test : ${OTP_CODE}`)
  console.log('─────────────────────────────────────────────')
  console.log('📤 Envoi en cours...\n')

  const resend = new Resend(RESEND_API_KEY)

  try {
    const result = await resend.emails.send({
      from: 'MYCHURCH <onboarding@resend.dev>',
      to: TO_EMAIL,
      subject: 'MYCHURCH – Code de vérification OTP (TEST)',
      html,
    })

    if (result.error) {
      console.error('❌ Erreur Resend:', result.error)
      console.error('\n💡 Causes possibles :')
      console.error('   • L\'email destinataire n\'est pas autorisé (clé sandbox = email Resend uniquement)')
      console.error('   • Clé API invalide ou expirée')
      console.error('   • Quota dépassé')
      process.exit(1)
    }

    console.log('✅ Email envoyé avec succès !')
    console.log('─────────────────────────────────────────────')
    console.log('📬 Détails de la réponse Resend :')
    console.log(`   ID de message : ${result.data?.id}`)
    console.log('\n🎉 Le système d\'envoi d\'email est fonctionnel en production.')
    console.log('   Vérifiez votre boîte de réception (et les spams).')
    console.log('─────────────────────────────────────────────\n')
  } catch (err) {
    console.error('❌ Erreur lors de l\'appel à Resend :', err.message || err)
    console.error('\n💡 Vérifications :')
    console.error('   • La clé RESEND_API_KEY dans .env est-elle correcte ?')
    console.error('   • Avez-vous accès à internet ?')
    process.exit(1)
  }
}

sendTestEmail()
