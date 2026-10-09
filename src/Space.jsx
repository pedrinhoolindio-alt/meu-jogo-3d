// src/Space.jsx
// Espaço realista: céu da Via Láctea (ESA Gaia), Sol com reflexo de lente, luz do Sol com sombras
// e planetas com texturas reais da NASA. Cada missão acontece num lugar do Sistema Solar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js'
import { game, MISSIONS } from './gameState'
import { useUI } from './store'
import { planetUrl, getQuality } from './assets'

const D2R = Math.PI / 180

// ---------------------------------------------------------------------------
// Locais (unidades do jogo; a nave fica perto da origem e o cenário "vem" em +Z)
//  sun: direção de onde vem a luz do Sol · sky: giro do céu · bodies: planetas e luas
// ---------------------------------------------------------------------------
const v = (x, y, z) => new THREE.Vector3(x, y, z)
export const LOCATIONS = {
  earth: {
    name: 'Órbita da Terra',
    sun: v(-0.78, 0.5, 0.2),
    sky: [0.3, 1.2, 0.5],
    earthshine: '#5d8fd6',
    bodies: [
      // Ceará visível logo abaixo: o planeta gira em X para dar a sensação de órbita
      { kind: 'earth', radius: 2600, pos: v(0, -3500, -3800), tilt: [-0.74, -0.9, 0], spin: 0.004 },
      { kind: 'moon', radius: 70, pos: v(2600, 900, -7000), spin: 0.002 },
    ],
  },
  moon: {
    name: 'Órbita da Lua',
    sun: v(0.75, 0.3, -0.55),
    sky: [1.2, 0.4, 0.2],
    earthshine: '#3a3f4a',
    bodies: [
      { kind: 'moon', radius: 1800, pos: v(300, -2250, -1900), tilt: [-0.9, 2.2, 0], spin: 0.006 },
      { kind: 'earth', radius: 260, pos: v(-2200, 1300, -6800), tilt: [0.3, 1.6, 0.4], spin: 0.01 },
    ],
  },
  mars: {
    name: 'Órbita de Marte',
    sun: v(-0.7, 0.25, -0.65),
    sky: [2.2, 0.8, 0.1],
    earthshine: '#8a4a2a',
    bodies: [
      { kind: 'mars', radius: 2300, pos: v(-200, -2750, -2000), tilt: [-0.95, 0.4, 0], spin: 0.005 },
      { kind: 'phobos', radius: 22, pos: v(900, 260, -2600), spin: 0.02 },
    ],
  },
  jupiter: {
    name: 'Luas de Júpiter',
    sun: v(0.6, 0.35, 0.45),
    sky: [0.6, 2.6, 0.9],
    earthshine: '#6a5a48',
    bodies: [
      { kind: 'jupiter', radius: 3600, pos: v(-3200, 300, -7600), tilt: [0.05, 0.2, 0.05], spin: 0.008 },
      { kind: 'io', radius: 120, pos: v(1400, 380, -3600), spin: 0.01 },
      { kind: 'europa', radius: 95, pos: v(-500, 650, -2900), spin: 0.01 },
    ],
  },
  saturn: {
    name: 'Anéis de Saturno',
    sun: v(-0.65, 0.4, 0.5),
    sky: [1.6, 3.5, 0.6],
    earthshine: '#5a5040',
    bodies: [{ kind: 'saturn', radius: 2400, pos: v(3000, 700, -7800), tilt: [0.45, 0.4, 0.35], spin: 0.009, ring: true }],
  },
  earthDawn: {
    name: 'Amanhecer na órbita da Terra',
    sun: v(0.12, 0.05, -1),
    sky: [0.9, 2.0, 0.3],
    earthshine: '#3d5f9a',
    bodies: [{ kind: 'earth', radius: 2600, pos: v(0, -3500, -3800), tilt: [-0.74, -2.4, 0], spin: 0.004 }],
  },
}

// Texturas de cada corpo: [inicial leve, alta (4K), máxima (8K)]
const TEX = {
  earthDay: ['earth_day_2k.jpg', 'earth_day_4k.jpg', 'earth_day_8k.jpg'],
  earthNight: ['earth_night_2k.jpg', 'earth_night_4k.jpg', 'earth_night_8k.jpg'],
  earthClouds: ['earth_clouds_1k.jpg', 'earth_clouds_2k.jpg', 'earth_clouds_4k.jpg'],
  earthOcean: ['earth_ocean_2k.jpg'],
  sky: ['sky_2k.jpg', 'sky_4k.jpg', 'sky_8k.jpg'],
  moon: ['moon_2k.jpg'],
  moonBump: ['moon_bump_2k.jpg'],
  mars: ['mars_2k.jpg'],
  marsBump: ['mars_bump_2k.jpg'],
  jupiter: ['jupiter_2k.jpg'],
  saturn: ['saturn_2k.jpg'],
  saturnRing: ['saturn_ring.png'],
  io: ['io_2k.jpg'],
  europa: ['europa_2k.jpg'],
}

// ---------------------------------------------------------------------------
// Carregamento progressivo: mostra a versão leve na hora e troca pela 4K/8K quando chegar
// ---------------------------------------------------------------------------
const cache = new Map()
// Gerenciador próprio: as texturas dos planetas carregam em segundo plano e não seguram a tela de carregamento
const loader = new THREE.TextureLoader(new THREE.LoadingManager())
loader.setCrossOrigin('anonymous')

function loadTex(file, srgb, gl) {
  if (cache.has(file)) return cache.get(file)
  const p = loader.loadAsync(planetUrl(file)).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = gl.capabilities.getMaxAnisotropy()
    return t
  })
  p.catch(() => cache.delete(file))
  cache.set(file, p)
  return p
}

function useTex(key, srgb = true) {
  const { gl } = useThree()
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let alive = true
    const list = TEX[key]
    const max = gl.capabilities.maxTextureSize
    const want = getQuality() === '8k' && max >= 8192 ? 2 : max >= 4096 ? 1 : 0
    const chain = list.slice(0, Math.min(list.length, want + 1))
    // Carrega em sequência: cada nível só substitui o anterior quando terminar
    chain.reduce(
      (prev, file) =>
        prev.then(() =>
          loadTex(file, srgb, gl).then((t) => {
            if (alive) setTex(t)
          })
        ),
      Promise.resolve()
    ).catch(() => {})
    return () => {
      alive = false
    }
  }, [key, srgb, gl])
  return tex
}

// ---------------------------------------------------------------------------
// Céu: esfera gigante com a Via Láctea (mapa de todo o céu feito pelo satélite Gaia)
// ---------------------------------------------------------------------------
function Sky({ rot }) {
  const tex = useTex('sky')
  const { scene } = useThree()
  // O mesmo céu serve de mapa de ambiente: reflexos reais nas naves
  useEffect(() => {
    if (!tex) return
    const env = tex.clone()
    env.mapping = THREE.EquirectangularReflectionMapping
    env.needsUpdate = true
    scene.environment = env
    scene.environmentIntensity = 1.6
    scene.environmentRotation.set(...rot)
    return () => {
      if (scene.environment === env) scene.environment = null
      env.dispose()
    }
  }, [tex, scene, rot])
  if (!tex) return null
  return (
    <mesh rotation={rot} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[14000, 64, 32]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} color={[1.15, 1.15, 1.15]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Sol: disco brilhante + reflexo de lente
// ---------------------------------------------------------------------------
function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([o, col]) => g.addColorStop(o, col))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Sun({ dir }) {
  const flareRef = useRef()
  const tex = useMemo(
    () => ({
      core: radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.12, 'rgba(255,250,235,1)'],
        [0.3, 'rgba(255,220,160,0.35)'],
        [1, 'rgba(255,180,100,0)'],
      ]),
      ring: radialTexture([
        [0, 'rgba(0,0,0,0)'],
        [0.6, 'rgba(0,0,0,0)'],
        [0.72, 'rgba(160,200,255,0.35)'],
        [0.8, 'rgba(0,0,0,0)'],
      ]),
      dot: radialTexture([
        [0, 'rgba(255,255,255,0.5)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    }),
    []
  )
  const flare = useMemo(() => {
    const f = new Lensflare()
    // Reflexo de lente discreto (como numa câmera real): brilho central + fantasmas bem fracos
    f.addElement(new LensflareElement(tex.dot, 160, 0, new THREE.Color(0.9, 0.85, 0.75)))
    f.addElement(new LensflareElement(tex.dot, 40, 0.55, new THREE.Color(0.05, 0.12, 0.08)))
    f.addElement(new LensflareElement(tex.dot, 70, 0.8, new THREE.Color(0.08, 0.06, 0.14)))
    f.addElement(new LensflareElement(tex.dot, 110, 1.05, new THREE.Color(0.12, 0.08, 0.05)))
    return f
  }, [tex])
  useEffect(() => () => flare.dispose(), [flare])
  const pos = useMemo(() => dir.clone().normalize().multiplyScalar(12000), [dir])
  return (
    <group position={pos}>
      {/* O Sol visto do espaço: disco pequeno e muito brilhante (o Bloom cria o halo) */}
      <sprite scale={[900, 900, 1]}>
        <spriteMaterial map={tex.core} color={[4, 3.8, 3.4]} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </sprite>
      <primitive ref={flareRef} object={flare} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Terra: shader com dia/noite, luzes das cidades, brilho do Sol no oceano, nuvens e atmosfera
// ---------------------------------------------------------------------------
const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWPos;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudMap;
  uniform sampler2D oceanMap;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWPos;
  void main() {
    vec3 N = normalize(vN);
    vec3 L = normalize(sunDir);
    vec3 V = normalize(cameraPosition - vWPos);
    float ndl = dot(N, L);
    // Terminador suave: transição dia → noite
    float dayAmt = smoothstep(-0.12, 0.22, ndl);

    vec3 day = texture2D(dayMap, vUv).rgb;
    vec2 cuv = vUv + vec2(cloudShift, 0.0);
    float clouds = smoothstep(0.32, 0.9, texture2D(cloudMap, cuv).r);
    // Sombra das nuvens no chão (amostra deslocada na direção do Sol)
    float cshadow = smoothstep(0.32, 0.9, texture2D(cloudMap, cuv + vec2(0.0015, 0.0008)).r);
    day *= 1.0 - cshadow * 0.4;

    // Brilho especular do Sol no oceano
    float ocean = texture2D(oceanMap, vUv).r;
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 320.0) * ocean * (1.0 - clouds) * 1.6;

    float diff = max(ndl, 0.0);
    vec3 lit = day * diff * 1.55 + vec3(1.0, 0.92, 0.8) * spec * step(0.0, ndl);
    lit = mix(lit, vec3(0.96, 0.97, 1.0) * diff * 1.7, clouds);

    // Luzes das cidades no lado noturno (apagadas sob nuvens)
    float night = texture2D(nightMap, vUv).r;
    vec3 cityLights = vec3(1.0, 0.68, 0.32) * pow(night, 1.6) * 2.6 * (1.0 - clouds * 0.85) * (1.0 - dayAmt);

    // Atmosfera vista por dentro (borda azulada) e faixa laranja no terminador
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 atmo = vec3(0.32, 0.6, 1.0) * fres * smoothstep(-0.25, 0.5, ndl) * 1.3;
    float term = smoothstep(-0.12, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.3, ndl));
    atmo += vec3(1.0, 0.42, 0.12) * term * fres * 0.8;

    gl_FragColor = vec4(lit + cityLights + atmo, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// Halo da atmosfera (esfera um pouco maior, só a borda brilha)
const haloVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWPos;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const haloFragment = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 color;
  uniform float power;
  varying vec3 vN;
  varying vec3 vWPos;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWPos);
    // Lado de trás da esfera: o brilho é máximo na borda do planeta e some para fora
    float rim = 1.0 - abs(dot(N, V));
    float glow = pow(rim, power) * smoothstep(-0.35, 0.4, dot(N, normalize(sunDir)));
    gl_FragColor = vec4(color * glow, glow);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function Halo({ radius, color, sun, scale = 1.025, power = 5 }) {
  const uniforms = useMemo(() => ({ sunDir: { value: sun }, color: { value: new THREE.Color(color) }, power: { value: power } }), [sun, color, power])
  return (
    <mesh scale={scale}>
      <sphereGeometry args={[radius, 96, 48]} />
      <shaderMaterial
        vertexShader={haloVertex}
        fragmentShader={haloFragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function Earth({ radius, sun }) {
  const day = useTex('earthDay')
  const night = useTex('earthNight', false)
  const clouds = useTex('earthClouds', false)
  const ocean = useTex('earthOcean', false)
  const uniforms = useMemo(
    () => ({
      dayMap: { value: null },
      nightMap: { value: null },
      cloudMap: { value: null },
      oceanMap: { value: null },
      sunDir: { value: sun },
      cloudShift: { value: 0 },
    }),
    [sun]
  )
  uniforms.dayMap.value = day
  uniforms.nightMap.value = night
  uniforms.cloudMap.value = clouds
  uniforms.oceanMap.value = ocean
  useFrame((_, delta) => {
    if (game.phase !== 'paused' && game.phase !== 'photo') uniforms.cloudShift.value += Math.min(delta, 0.05) * 0.0006
  })
  if (!day || !night || !clouds || !ocean) return null
  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, 192, 96]} />
        <shaderMaterial vertexShader={earthVertex} fragmentShader={earthFragment} uniforms={uniforms} />
      </mesh>
      <Halo radius={radius} color="#4f9bff" sun={sun} scale={1.028} power={4} />
    </>
  )
}

// Planetas e luas com material físico (iluminados pela luz do Sol da cena)
const SIMPLE = {
  moon: { map: 'moon', bump: 'moonBump', bumpScale: 3 },
  phobos: { map: 'moon', bump: 'moonBump', bumpScale: 2, tint: '#8a7a6a' },
  mars: { map: 'mars', bump: 'marsBump', bumpScale: 3, halo: '#ff9a6a', haloPower: 6 },
  jupiter: { map: 'jupiter', halo: '#d8b58a', haloPower: 7 },
  saturn: { map: 'saturn', halo: '#e8d3a0', haloPower: 7 },
  io: { map: 'io' },
  europa: { map: 'europa' },
}

function SimpleBody({ kind, radius, sun, ring }) {
  const cfg = SIMPLE[kind]
  const map = useTex(cfg.map)
  const bump = useTex(cfg.bump || cfg.map, false)
  if (!map) return null
  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, 128, 64]} />
        <meshStandardMaterial
          map={map}
          bumpMap={cfg.bump ? bump : null}
          bumpScale={cfg.bumpScale || 0}
          color={cfg.tint || '#ffffff'}
          roughness={0.95}
          metalness={0}
          fog={false}
        />
      </mesh>
      {cfg.halo && <Halo radius={radius} color={cfg.halo} sun={sun} scale={1.02} power={cfg.haloPower} />}
      {ring && <SaturnRing radius={radius} />}
    </>
  )
}

// Anéis: a textura é uma faixa radial (de dentro para fora); remapeamos as UVs do anel
function SaturnRing({ radius }) {
  const tex = useTex('saturnRing')
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(radius * 1.24, radius * 2.27, 256, 1)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    const p = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i)
      // u = distância normalizada do centro (0 = borda interna, 1 = externa)
      uv.setXY(i, (p.length() - radius * 1.24) / (radius * (2.27 - 1.24)), 0.5)
    }
    return g
  }, [radius])
  if (!tex) return null
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial map={tex} transparent side={THREE.DoubleSide} roughness={1} metalness={0} fog={false} depthWrite={false} />
    </mesh>
  )
}

function Body({ cfg, sun }) {
  const spinRef = useRef()
  useFrame((_, delta) => {
    if (game.phase === 'paused' || game.phase === 'photo') return
    // Giro em X: a superfície "passa" por baixo da nave → sensação de estar em órbita
    spinRef.current.rotation.x += Math.min(delta, 0.05) * cfg.spin * (game.worldMul || 1)
  })
  const [tx, ty, tz] = cfg.tilt || [0, 0, 0]
  return (
    <group position={cfg.pos}>
      <group ref={spinRef} rotation={[tx, 0, tz]}>
        <group rotation={[0, ty, 0]}>
          {cfg.kind === 'earth' ? (
            <Earth radius={cfg.radius} sun={sun} />
          ) : (
            <SimpleBody kind={cfg.kind} radius={cfg.radius} sun={sun} ring={cfg.ring} />
          )}
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Luz do Sol (com sombras que acompanham a nave) e luz refletida do planeta
// ---------------------------------------------------------------------------
function SunLight({ dir, earthshine }) {
  const light = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const p = game.shipPos
    light.current.position.copy(p).addScaledVector(dir, 60)
    target.position.copy(p)
    target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={3.6}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
      {/* Luz refletida pelo planeta abaixo (preenche o lado escuro das naves) */}
      <hemisphereLight args={['#0a0d18', earthshine, 0.55]} />
      <ambientLight intensity={0.04} />
    </>
  )
}

// Qual local mostrar: na tela de título e no hangar, a órbita da Terra
export function useLocationKey() {
  const phase = useUI((s) => s.phase)
  const mission = useUI((s) => s.mission)
  if (phase === 'title' || phase === 'hangar' || mission == null) return 'earth'
  return MISSIONS[mission]?.location || 'earth'
}

export default function Space() {
  const key = useLocationKey()
  const loc = LOCATIONS[key]
  const sun = useMemo(() => loc.sun.clone().normalize(), [loc])
  return (
    <group key={key}>
      <Sky rot={loc.sky} />
      <Sun dir={sun} />
      <SunLight dir={sun} earthshine={loc.earthshine} />
      {loc.bodies.map((b, i) => (
        <Body key={i} cfg={b} sun={sun} />
      ))}
    </group>
  )
}

export { D2R }
