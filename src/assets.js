// src/assets.js
// De onde carregar modelos 3D e texturas de planetas.
// 1º tenta a pasta local /assets (npm run dev, se você copiar o repositório fenix-assets para public/assets).
// Se não existir (ex.: Google AI Studio), baixa do repositório público "fenix-assets" pela CDN jsDelivr.
import PHOTOS from './embedded/portraits'

const LOCAL = (import.meta.env.BASE_URL || '/') + 'assets/'
// Versão fixa (commit) para a CDN não servir arquivos antigos do cache
export const ASSETS_VERSION = 'e5be13ba240dddf1fb17a19fc1565b4333275d47'
const CDN = `https://cdn.jsdelivr.net/gh/pedrinhoolindio-alt/fenix-assets@${ASSETS_VERSION}/`

let base = CDN

export async function resolveAssetBase() {
  try {
    const r = await fetch(LOCAL + 'manifest.json', { cache: 'no-store' })
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) base = LOCAL
  } catch {
    /* sem pasta local: usa a CDN */
  }
  return base
}

export const modelUrl = (name) => `${base}models/${name}.glb`
export const planetUrl = (file) => `${base}planets/${file}`

// Modelos (Quaternius Ultimate Spaceships Pack — CC0) com mapas PBR gerados
export const SHIPS = {
  player: 'executioner_blue',
  janiele: 'executioner_green',
  wing3: 'executioner_orange',
  fighter: 'dispatcher_red',
  interceptor: 'striker_red',
  bomber: 'insurgent_red',
  kamikaze: 'zenith_red',
  gunship: 'omen_red',
  carrier: 'challenger_red',
  sniper: 'spitfire_red',
  boss: 'pancake_red',
  allyCruiser: 'imperial_blue',
  enemyCruiser: 'imperial_red',
}

// Foto/avatar do personagem (data URL embutido — repositório privado)
export const photoUrl = (key) => PHOTOS[key]

// ---------------------------------------------------------------------------
// Qualidade gráfica: 8K (texturas máximas) ou 4K (mais leve)
// ---------------------------------------------------------------------------
export function getQuality() {
  try {
    const q = localStorage.getItem('fenix-gfx')
    if (q === '8k' || q === '4k') return q
  } catch {
    /* ignora */
  }
  // Padrão: 8K em computadores, 4K em celulares
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '4k' : '8k'
}

export function setQuality(q) {
  try {
    localStorage.setItem('fenix-gfx', q)
  } catch {
    /* ignora */
  }
}
