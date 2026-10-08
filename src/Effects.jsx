// src/Effects.jsx
// Pós-processamento: Bloom (brilho dos lasers/motores), aberração cromática ao levar dano e vinheta.
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { game } from './gameState'

export default function Effects() {
  // O efeito guarda a referência deste Vector2: basta alterá-lo a cada frame
  const offset = useMemo(() => new THREE.Vector2(0.0004, 0.0004), [])
  useFrame(() => {
    const k = 0.0004 + game.damageFlash * 0.006 + (game.boosting ? 0.0016 : 0)
    offset.set(k, k * 0.6)
  })
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.8} luminanceSmoothing={0.25} radius={0.75} />
      <ChromaticAberration offset={offset} radialModulation={false} modulationOffset={0} />
      <Vignette eskil={false} offset={0.25} darkness={0.75} />
    </EffectComposer>
  )
}
