/**
 * Test d'envoi réel via SMTP (recommandé : Gmail "mot de passe d'application").
 * Usage : node scripts/test-smtp.mjs <email_destinataire>
 *
 * Avant : activer la double authentification sur le compte Google, puis créer un
 * "mot de passe d'application" (Mon compte Google → Sécurité → Mots de passe d'application).
 * Renseigner SMTP_USER / SMTP_PASS dans le fichier .env (valeurs utilisées par ce script).
 */

import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ SMTP_USER / SMTP_PASS manquants dans .env')
  process.exit(1)
}

const TO_EMAIL = process.argv[2]
if (!TO_EMAIL || !TO_EMAIL.includes('@')) {
  console.error('❌ Usage: node scripts/test-smtp.mjs votre@email.com')
  process.exit(1)
}

const html = `
<div style="max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 2px;">MYCHURCH</h1>
    <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 14px;">Test SMTP</p>
  </div>
  <div style="padding: 32px 24px;">
    <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">Bonjour,</p>
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
      Ceci est un email de test envoyé via <strong style="color: #1f2937;">SMTP (${SMTP_USER})</strong>.<br/>
      Si vous le recevez, le système d'email de MYCHURCH est fonctionnel end-to-end.
    </p>
  </div>
  <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
    <p style="margin: 0; color: #9ca3af; font-size: 11px;">
      &copy; ${new Date().getFullYear()} MYCHURCH. Created by Henock Aduma.
    </p>
  </div>
</div>
`

async function main() {
  console.log('\n🚀 MYCHURCH – Test SMTP')
  console.log('──────────────────────────────')
  console.log(`📧 Destinataire : ${TO_EMAIL}`)
  console.log(`📤 Serveur   : ${process.env.SMTP_HOST || 'smtp.gmail.com'} : ${process.env.SMTP_PORT || 465}`)
  console.log(`👤 Expéditeur : ${SMTP_USER}`)
  console.log('──────────────────────────────')

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  try {
    console.log('📤 Envoi en cours...\n')
    const info = await transport.sendMail({
      from: `MYCHURCH <${SMTP_USER}>`,
      to: TO_EMAIL,
      subject: 'MYCHURCH – Test SMTP',
      html,
    })
    console.log('✅ Email envoyé avec succès !')
    console.log(`   ID : ${info.messageId}`)
    console.log('   Vérifiez votre boîte de réception (et les spams).\n')
  } catch (err) {
    console.error('❌ Erreur SMTP :', err.message || err)
    console.error('\n💡 Causes fréquentes :')
    console.error('   • SMTP_PASS doit être un MOT DE PASSE D\'APPLICATION (16 lettres), pas votre mot de passe normal.')
    console.error('   • La double authentification (2FA) doit être activée sur le compte Google.')
    console.error('   • Vérifiez SMTP_HOST / SMTP_PORT (Gmail = smtp.gmail.com:465).')
    process.exit(1)
  }
}

main()