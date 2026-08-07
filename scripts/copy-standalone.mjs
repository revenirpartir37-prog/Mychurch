// Copie les dossiers requis dans .next/standalone (cross-platform Windows/Linux).
import { cpSync, existsSync, mkdirSync } from 'node:fs'

const root = process.cwd()
const standalone = '.next/standalone'

const tasks = [
  { from: '.next/static', to: `${standalone}/.next/static` },
  { from: 'public', to: `${standalone}/public` },
]

for (const t of tasks) {
  if (!existsSync(t.from)) {
    console.warn(`[copy-standalone] source manquante, ignorée: ${t.from}`)
    continue
  }
  mkdirSync(`${root}/${t.to}`, { recursive: true })
  cpSync(t.from, `${root}/${t.to}`, { recursive: true, force: true })
  console.log(`[copy-standalone] copié ${t.from} -> ${t.to}`)
}
