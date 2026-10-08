// scripts/embed-assets.mjs
// Gera módulos JS com os arquivos binários em base64 (src/embedded/).
// Necessário porque o Google AI Studio só importa arquivos de texto do GitHub.
// Rodar depois de trocar fotos ou modelos:  node scripts/embed-assets.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'

mkdirSync('src/embedded/models', { recursive: true })

// Fotos dos personagens (assets-src/portraits/*.jpg) → um único módulo
const photos = {}
for (const f of readdirSync('assets-src/portraits').filter((f) => f.endsWith('.jpg'))) {
  photos[f.replace('.jpg', '')] = 'data:image/jpeg;base64,' + readFileSync(`assets-src/portraits/${f}`).toString('base64')
}
writeFileSync('src/embedded/portraits.js', '// Gerado por scripts/embed-assets.mjs — não editar à mão\nexport default ' + JSON.stringify(photos, null, 1) + '\n')

// Modelos 3D (public/models/*.glb) → um módulo por modelo (carregados só quando necessário)
for (const f of readdirSync('public/models').filter((f) => f.endsWith('.glb'))) {
  const b64 = readFileSync(`public/models/${f}`).toString('base64')
  writeFileSync(`src/embedded/models/${f.replace('.glb', '.js')}`, `// Gerado por scripts/embed-assets.mjs — não editar à mão\nexport default '${b64}'\n`)
}
console.log('Fotos:', Object.keys(photos).join(', '))
