import { execFileSync } from 'node:child_process'

execFileSync(process.execPath, ['./node_modules/prisma/build/index.js', 'validate'], { stdio: 'inherit' })