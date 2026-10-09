// src/Surface.jsx
// SUBFASE PLANETÁRIA: depois de entrar na atmosfera, a batalha continua perto do solo.
//  - Terra: céu de FORTALEZA-CE com o solo montado com imagens de satélite reais da cidade
//    (baixadas em tempo real: Esri World Imagery; se falhar, Sentinel-2 cloudless da EOX)
//  - Lua e Marte: solo com as texturas reais dos planetas; Júpiter e Saturno: topo das nuvens
// Escala: 1 unidade do jogo ≈ 2 metros.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './gameState'
import { useTex, Sky, Sun, Body, SunLight, SaturnRing } from './Space'

const UNITS_PER_METER = 0.5
const v = (x, y, z) => new THREE.Vector3(x, y, z)

// Centro do mapa: Fortaleza-CE, entre o Centro, a Praia de Iracema e a Aldeota (o mar fica ao norte = −Z)
export const FORTALEZA = { lat: -3.7275, lon: -38.5 }

export const SURFACES = {
  fortaleza: {
    label: 'CÉU DE FORTALEZA-CE',
    ground: 'map',
    sun: v(-0.55, 0.75, 0.35), // tarde: sol alto, vindo do oeste
    sunColor: '#fff3df',
    top: '#2c6fd6',
    horizon: '#b9d5ef',
    below: '#9bb8cf',
    fog: [1600, 10500],
    tint: [1.06, 1.06, 1.06],
    clouds: '#ffffff',
    light: 3.2,
  },
  fortalezaDawn: {
    label: 'AMANHECER EM FORTALEZA-CE',
    ground: 'map',
    sun: v(1, 0.1, -0.12), // nascendo no leste, sobre o mar
    sunColor: '#ffc28a',
    top: '#22355f',
    horizon: '#f2a46a',
    below: '#c98a6a',
    fog: [1400, 9500],
    tint: [0.95, 0.78, 0.66],
    clouds: '#ffc3a3',
    light: 2.6,
  },
  moonSurface: {
    label: 'SUPERFÍCIE DA LUA',
    ground: 'tex',
    map: 'moon',
    repeat: 3,
    groundColor: '#bdbdbd',
    sun: v(0.6, 0.35, -0.5),
    sunColor: '#ffffff',
    space: true, // sem atmosfera: céu estrelado e Terra no céu
    light: 3.6,
    extras: 'earthInSky',
  },
  marsSurface: {
    label: 'VALLES MARINERIS · MARTE',
    ground: 'tex',
    map: 'mars',
    repeat: 3,
    groundColor: '#ffffff',
    sun: v(-0.5, 0.55, -0.4),
    sunColor: '#ffe8cf',
    top: '#a77a55',
    horizon: '#e3b48a',
    below: '#c8946a',
    fog: [1800, 11000],
    light: 3,
  },
  jupiterClouds: {
    label: 'TOPO DAS NUVENS DE JÚPITER',
    ground: 'clouds',
    map: 'jupiter',
    repeat: 2,
    groundColor: '#ffe9cc',
    sun: v(0.4, 0.6, 0.5),
    sunColor: '#fff0d8',
    top: '#3d3226',
    horizon: '#d4b48a',
    below: '#b8946a',
    fog: [1500, 9000],
    clouds: '#e8cfa8',
    light: 2.6,
    extras: 'jovianMoons',
  },
  saturnClouds: {
    label: 'TEMPESTADE DE SATURNO',
    ground: 'clouds',
    map: 'saturn',
    repeat: 3,
    groundColor: '#fff4dc',
    sun: v(-0.5, 0.5, 0.45),
    sunColor: '#fff4e0',
    top: '#2b3550',
    horizon: '#e3d2a6',
    below: '#c9b68a',
    fog: [1500, 9000],
    clouds: '#efe2c0',
    light: 2.6,
    extras: 'rings',
  },
}

// ---------------------------------------------------------------------------
// Céu atmosférico: esfera presa à câmera com degradê zênite → horizonte e o disco do Sol
// ---------------------------------------------------------------------------
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 below;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Acima do horizonte: mistura com curva (o azul "fecha" rápido); abaixo: cor da névoa
    vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.45)) : mix(horizon, below, smoothstep(0.0, 0.08, -h));
    // Sol: disco (potência alta) + halo + clarão largo da atmosfera
    float sd = max(dot(d, normalize(sunDir)), 0.0);
    col += sunColor * (pow(sd, 1200.0) * 40.0 + pow(sd, 80.0) * 0.6 + pow(sd, 6.0) * 0.22);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function SkyDome({ cfg, sun }) {
  const ref = useRef()
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color(cfg.top) },
      horizon: { value: new THREE.Color(cfg.horizon) },
      below: { value: new THREE.Color(cfg.below) },
      sunDir: { value: sun },
      sunColor: { value: new THREE.Color(cfg.sunColor) },
    }),
    [cfg, sun]
  )
  // O céu acompanha a câmera (fica "no infinito")
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return (
    <mesh ref={ref} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[20000, 48, 24]} />
      <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

// Névoa da atmosfera (mesma cor do horizonte) e mapa de ambiente em degradê para os reflexos
function Atmosphere({ cfg }) {
  const { scene } = useThree()
  useEffect(() => {
    const prevFog = scene.fog
    if (cfg.fog) scene.fog = new THREE.Fog(cfg.horizon, cfg.fog[0], cfg.fog[1])
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, cfg.top || '#000000')
    g.addColorStop(0.5, cfg.horizon || '#202020')
    g.addColorStop(0.52, cfg.below || '#101010')
    g.addColorStop(1, '#2a2a2a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 128)
    const env = new THREE.CanvasTexture(c)
    env.mapping = THREE.EquirectangularReflectionMapping
    env.colorSpace = THREE.SRGBColorSpace
    const prevEnv = scene.environment
    if (!cfg.space) {
      scene.environment = env
      scene.environmentIntensity = 1.2
    }
    return () => {
      scene.fog = prevFog
      if (scene.environment === env) scene.environment = prevEnv
      env.dispose()
    }
  }, [cfg, scene])
  return null
}

// ---------------------------------------------------------------------------
// Imagens de satélite de Fortaleza (mosaico de "tiles" Web Mercator montado num canvas)
// ---------------------------------------------------------------------------
// Coordenadas do tile (x, y fracionários) de uma latitude/longitude no zoom z:
//   x = (lon + 180) / 360 · 2^z
//   y = (1 − ln(tan φ + sec φ) / π) / 2 · 2^z
function tileXY(lat, lon, z) {
  const n = 2 ** z
  const phi = (lat * Math.PI) / 180
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n]
}

const SOURCES = [
  { id: 'esri', url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
  { id: 'eox', url: (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg` },
]

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Tenta cada fonte em ordem; devolve a imagem e de onde veio
async function loadTile(z, x, y) {
  for (const s of SOURCES) {
    try {
      return { img: await loadImage(s.url(z, x, y)), source: s.id }
    } catch {
      /* tenta a próxima */
    }
  }
  return null
}

const layers = new Map()
/**
 * Camada do mapa: n×n tiles no zoom z em volta do centro.
 * Devolve na hora uma textura (canvas) que vai sendo preenchida conforme os tiles chegam.
 *  size: lado do quadrado em unidades do jogo · x/z: deslocamento do centro do canvas
 */
function mapLayer(center, z, n, maxAniso) {
  const key = `${z}/${n}`
  if (layers.has(key)) return layers.get(key)
  const [fx, fy] = tileXY(center.lat, center.lon, z)
  const x0 = Math.floor(fx) - n / 2
  const y0 = Math.floor(fy) - n / 2
  // Metros por tile no Equador = circunferência / 2^z; encolhe com o cosseno da latitude
  const metersPerTile = (40075016.686 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z
  const unitsPerTile = metersPerTile * UNITS_PER_METER
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = n * 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#36513f'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAniso
  const layer = {
    tex,
    size: n * unitsPerTile,
    // Centro do canvas (em tiles: x0 + n/2) menos o centro desejado (fx) → deslocamento no mundo.
    // X do tile cresce para o LESTE (+X); Y do tile cresce para o SUL (+Z)
    x: (x0 + n / 2 - fx) * unitsPerTile,
    z: (y0 + n / 2 - fy) * unitsPerTile,
    loaded: 0,
    total: n * n,
  }
  layers.set(key, layer)
  let dirty = false
  const timer = setInterval(() => {
    if (dirty) {
      tex.needsUpdate = true // reenvia o canvas para a GPU no máximo 3× por segundo
      dirty = false
    }
    if (layer.loaded >= layer.total) clearInterval(timer)
  }, 330)
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      loadTile(z, x0 + tx, y0 + ty).then((r) => {
        layer.loaded++
        if (!r) return
        ctx.drawImage(r.img, tx * 256, ty * 256)
        dirty = true
        if (!game.mapSource || r.source === 'esri') game.mapSource = r.source
      })
    }
  }
  return layer
}

function MapGround({ cfg }) {
  const { gl } = useThree()
  const aniso = gl.capabilities.getMaxAnisotropy()
  // Visão ampla (zoom 13: ~39 km) e detalhe da cidade (zoom 15: ~9,8 km, ~4,8 m por pixel)
  const wide = useMemo(() => mapLayer(FORTALEZA, 13, 8, aniso), [aniso])
  const detail = useMemo(() => mapLayer(FORTALEZA, 15, 8, aniso), [aniso])
  const tint = useMemo(() => new THREE.Color(...cfg.tint), [cfg])
  return (
    <>
      {/* Camada ampla: desenhada antes e sem escrever profundidade (evita "briga" com a de detalhe) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wide.x, -0.5, wide.z]} renderOrder={-5}>
        <planeGeometry args={[wide.size, wide.size]} />
        <meshBasicMaterial map={wide.tex} color={tint} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[detail.x, 0, detail.z]} renderOrder={-4}>
        <planeGeometry args={[detail.size, detail.size]} />
        <meshBasicMaterial map={detail.tex} color={tint} />
      </mesh>
    </>
  )
}

// Textura de ruído (relevo fino perto do chão)
let _noise = null
function noiseTexture() {
  if (_noise) return _noise
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(s, s)
  for (let i = 0; i < s * s; i++) {
    const v = 110 + Math.random() * 90
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.filter = 'blur(1.5px)'
  ctx.drawImage(c, 0, 0)
  _noise = new THREE.CanvasTexture(c)
  _noise.wrapS = _noise.wrapT = THREE.RepeatWrapping
  return _noise
}

// Solo com textura do planeta repetida (Lua, Marte)
function TexGround({ cfg }) {
  const map = useTex(cfg.map)
  const size = 40000
  const tex = useMemo(() => {
    if (!map) return null
    const t = map.clone() // clone: a esfera do planeta continua com a textura sem repetição
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(cfg.repeat, cfg.repeat)
    t.needsUpdate = true
    return t
  }, [map, cfg])
  const bump = useMemo(() => {
    const n = noiseTexture().clone()
    n.repeat.set(size / 60, size / 60)
    n.needsUpdate = true
    return n
  }, [])
  if (!tex) return null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-4}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={tex} bumpMap={bump} bumpScale={1.5} color={cfg.groundColor} roughness={1} metalness={0} />
    </mesh>
  )
}

// Topo das nuvens de um gigante gasoso: textura repetida que desliza devagar (ventos)
function CloudDeck({ cfg }) {
  const map = useTex(cfg.map)
  const tex = useMemo(() => {
    if (!map) return null
    const t = map.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(cfg.repeat, cfg.repeat)
    t.needsUpdate = true
    return t
  }, [map, cfg])
  useFrame((_, dt) => {
    if (tex && game.phase === 'playing') tex.offset.x += Math.min(dt, 0.05) * 0.0015
  })
  if (!tex) return null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-4}>
      <planeGeometry args={[40000, 40000]} />
      <meshBasicMaterial map={tex} color={cfg.groundColor} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Nuvens soltas (sprites com textura de "algodão" gerada em canvas)
// ---------------------------------------------------------------------------
let _puff = null
function puffTexture() {
  if (_puff) return _puff
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  for (let i = 0; i < 26; i++) {
    const x = s / 2 + (Math.random() - 0.5) * s * 0.5
    const y = s / 2 + (Math.random() - 0.5) * s * 0.25
    const r = s * (0.12 + Math.random() * 0.16)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }
  _puff = new THREE.CanvasTexture(c)
  _puff.colorSpace = THREE.SRGBColorSpace
  return _puff
}

function Clouds({ color }) {
  const tex = puffTexture()
  const list = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => {
        // Algumas nuvens baixas perto da área de combate; o resto espalhado até o horizonte
        const near = i < 22
        const r = near ? 400 + Math.random() * 2200 : 1500 + Math.random() * 7500
        const a = Math.random() * Math.PI * 2
        const s = near ? 220 + Math.random() * 380 : 500 + Math.random() * 900
        return { pos: [Math.cos(a) * r, (near ? 520 : 700) + Math.random() * 450, Math.sin(a) * r], scale: [s * 1.8, s * 0.75, 1] }
      }),
    []
  )
  return (
    <>
      {list.map((c, i) => (
        <sprite key={i} position={c.pos} scale={c.scale}>
          <spriteMaterial map={tex} color={color} transparent opacity={0.9} depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}

function Extras({ kind, sun }) {
  if (kind === 'earthInSky')
    return (
      <>
        <Sky rot={[0.3, 1.2, 0.5]} />
        <Sun dir={sun} />
        <Body cfg={{ kind: 'earth', radius: 900, pos: v(-5200, 4300, -10500), tilt: [0.3, 1.6, 0.4], spin: 0.003 }} sun={sun} />
      </>
    )
  if (kind === 'jovianMoons')
    return (
      <>
        <Body cfg={{ kind: 'io', radius: 420, pos: v(3600, 4200, -10500), spin: 0.004 }} sun={sun} />
        <Body cfg={{ kind: 'europa', radius: 300, pos: v(-4200, 2600, -11500), spin: 0.004 }} sun={sun} />
      </>
    )
  if (kind === 'rings')
    return (
      <group position={[0, -6000, 6500]} rotation={[0.7, 0, 0.18]}>
        <SaturnRing radius={7000} />
      </group>
    )
  return null
}

export default function Surface({ kind }) {
  const cfg = SURFACES[kind]
  const sun = useMemo(() => cfg.sun.clone().normalize(), [cfg])
  useEffect(() => {
    game.ground = 0
    game.surfaceLabel = cfg.label
    game.surfaceKind = kind
    return () => {
      game.surfaceLabel = null
      game.surfaceKind = null
    }
  }, [cfg, kind])
  return (
    <group>
      <Atmosphere cfg={cfg} />
      {!cfg.space && <SkyDome cfg={cfg} sun={sun} />}
      <SunLight
        dir={sun}
        color={cfg.sunColor}
        intensity={cfg.light}
        sky={cfg.space ? '#05070c' : cfg.top}
        earthshine={cfg.space ? '#3a3a3a' : cfg.below}
        hemi={cfg.space ? 0.3 : 0.9}
        ambient={cfg.space ? 0.03 : 0.12}
      />
      {cfg.ground === 'map' && <MapGround cfg={cfg} />}
      {cfg.ground === 'tex' && <TexGround cfg={cfg} />}
      {cfg.ground === 'clouds' && <CloudDeck cfg={cfg} />}
      {cfg.clouds && <Clouds color={cfg.clouds} />}
      {cfg.extras && <Extras kind={cfg.extras} sun={sun} />}
    </group>
  )
}
