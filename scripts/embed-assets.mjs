// scripts/embed-assets.mjs
// Gera um módulo JS com os avatares em base64 (src/embedded/portraits.js).
// Necessário porque o Google AI Studio só importa arquivos de texto do GitHub.
// (Modelos e planetas ficam no repositório público fenix-assets, servidos pela CDN.)
// Rodar depois de trocar fotos ou modelos:  node scripts/embed-assets.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'

mkdirSync('src/embedded', { recursive: true })

// Fotos dos personagens (assets-src/portraits/*.jpg) → um único módulo
const photos = {}
for (const f of readdirSync('assets-src/portraits').filter((f) => f.endsWith('.jpg'))) {
  photos[f.replace('.jpg', '')] = 'data:image/jpeg;base64,' + readFileSync(`assets-src/portraits/${f}`).toString('base64')
}
writeFileSync('src/embedded/portraits.js', '// Gerado por scripts/embed-assets.mjs — não editar à mão\nexport default ' + JSON.stringify(photos, null, 1) + '\n')

console.log('Fotos:', Object.keys(photos).join(', '))
