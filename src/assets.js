// src/assets.js
// Descobre de onde carregar os modelos 3D.
// 1º tenta a pasta local /models (npm run dev / build) — mais rápido e fica em cache.
// Se não existir (ex.: Google AI Studio, que não importa arquivos binários), usa as cópias
// embutidas em base64 (src/embedded/models), geradas por scripts/embed-assets.mjs.
import PHOTOS from './embedded/portraits'

const LOCAL = (import.meta.env.BASE_URL || '/') + 'models/'
const EMBEDDED = import.meta.glob('./embedded/models/*.js') // carregamento sob demanda

// Modelos usados no jogo (Quaternius Ultimate Spaceships Pack — licença CC0)
export const SHIPS = {
  player: 'executioner_blue',
  janiele: 'executioner_green',
  wing3: 'executioner_orange',
  fighter: 'dispatcher_red',
  interceptor: 'striker_red',
  bomber: 'insurgent_red',
  boss: 'pancake_red',
  allyCruiser: 'imperial_blue',
  enemyCruiser: 'imperial_red',
}

const urls = {}

async function blobFromEmbedded(name) {
  const mod = await EMBEDDED[`./embedded/models/${name}.js`]()
  const bin = Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0))
  return URL.createObjectURL(new Blob([bin], { type: 'model/gltf-binary' }))
}

export async function resolveAssetBase() {
  let local = false
  try {
    const r = await fetch(LOCAL + 'manifest.json', { cache: 'no-store' })
    local = r.ok && (r.headers.get('content-type') || '').includes('json')
  } catch {
    /* sem pasta local */
  }
  const names = [...new Set(Object.values(SHIPS))]
  if (local) {
    names.forEach((n) => (urls[n] = LOCAL + n + '.glb'))
  } else {
    await Promise.all(names.map(async (n) => (urls[n] = await blobFromEmbedded(n))))
  }
}

export const modelUrl = (name) => urls[name]

// Foto do personagem (data URL)
export const photoUrl = (key) => PHOTOS[key]
