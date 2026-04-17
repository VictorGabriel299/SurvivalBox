const biomeLayers = {
    grassland: {
            surface: [
                { id: 1, class: 1, data: 1, geo: 0, threshold: 0.05 },
                { id: 1, class: 1, data: 2, threshold: 0.1 },
                { id: 1, class: 1, data: 3, threshold: 0.15 },
                { id: 1, class: 1, data: 4, threshold: 0.2 },
                { id: 1, class: 1, threshold: 1 }
            ],
            bellowSurface: { id: 2, class: 2, data: 1 },
            soil: { id: 2, class: 2 },
            rock: { id: 3, class: 3 }
    },
    desert: {
            surface: { id: 2, class: 2 },
            bellowSurface: { id: 2, class: 2 },
            soil: { id: 2, class: 2 },
            rock: { id: 3, class: 3 }
    },
    mountain: {
            surface: [
                { id: 1, class: 1, data: 1, threshold: 0.05 },
                { id: 1, class: 1, data: 2, threshold: 0.1 },
                { id: 1, class: 1, data: 3, threshold: 0.15 },
                { id: 1, class: 1, data: 4, threshold: 0.2 },
                { id: 1, class: 1, threshold: 0.25 },
                { id: 3, class: 3, threshold: 1 },
            ],
            bellowSurface: { id: 3, class: 3 },
            soil: { id: 3, class: 3 },
            rock: { id: 3, class: 3 }
    },
    peak: {
            surface: [
                { id: 1, class: 1, data: 1, threshold: 0.002 },
                { id: 1, class: 1, data: 2, threshold: 0.004 },
                { id: 1, class: 1, data: 3, threshold: 0.006 },
                { id: 1, class: 1, data: 4, threshold: 0.008 },
                { id: 1, class: 1, threshold: 0.01 },
                { id: 3, class: 3, threshold: 1 },
            ],
            bellowSurface: { id: 3, class: 3 },
            soil: { id: 3, class: 3 },
            rock: { id: 3, class: 3 }
    }
}

// terrain generation
const seed = Math.random() * 100000000

let world = []
let biome = []

const chunkSize = 16
let chunks = new Map()
let chunkQueue = []
let chunkMeshQueue = []
const chunksPerFrame = 1


function hash(x, z) {
  let h = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453123
  return h - Math.floor(h)
}

function noise(x, z) {
  const iX = Math.floor(x)
  const iZ = Math.floor(z)
  const fX = x - iX
  const fZ = z - iZ

  const uX = fX * fX * (3.0 - 2.0 * fX)
  const uZ = fZ * fZ * (3.0 - 2.0 * fZ)

  const a = hash(iX, iZ)
  const b = hash(iX + 1, iZ)
  const c = hash(iX, iZ + 1)
  const d = hash(iX + 1, iZ + 1)

  return a + (b - a) * uX + (c - a) * uZ + (a - b - c + d) * uX * uZ
}

function fbm(x, z, octaves, persistence, lacunarity) {
  let total = 0
  let frequency = 1
  let amplitude = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, z * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  return total / maxValue
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function getHeight(x, z) {
  const continentalness = fbm(x * heightScale, z * heightScale, 3, 0.5, 2.0)
  const erosion = fbm(x * heightScale * 0.8, z * heightScale * 0.8, 3, 0.5, 2.0)
  const peaksValleys = fbm(x * heightScale * 2.2, z * heightScale * 2.2, 4, 0.5, 2.0)

  const isDepression = smoothstep(0.2, 0.0, continentalness)
  const isPlain = smoothstep(0.3, 0.5, continentalness) * smoothstep(0.4, 0.7, erosion)
  const isNormal = smoothstep(0.4, 0.6, continentalness) * smoothstep(0.7, 0.4, erosion)
  const isHill = smoothstep(0.6, 0.8, peaksValleys) * smoothstep(0.5, 0.3, erosion)
  const isPlateau = smoothstep(0.7, 0.9, continentalness) * smoothstep(0.4, 0.8, erosion)
  const isMountain = smoothstep(0.7, 0.9, continentalness) * smoothstep(0.3, 0.0, erosion)
  
  let ridge = noise(x * heightScale * 3.5, z * heightScale * 3.5)
  ridge = 1.0 - Math.abs(ridge - 0.5) * 2.0
  const isPeak = Math.pow(ridge, 4) * isMountain

  const hDepression = baseHeight - 20 + fbm(x * 0.02, z * 0.02, 2, 0.5, 2.0) * 5
  const hPlain = baseHeight + fbm(x * 0.01, z * 0.01, 1, 0.5, 2.0) * 3
  const hNormal = baseHeight + 10 + fbm(x * 0.02, z * 0.02, 3, 0.5, 2.0) * 12
  const hHill = baseHeight + 25 + peaksValleys * 25
  const hPlateau = baseHeight + 55 + fbm(x * 0.01, z * 0.01, 1, 0.5, 2.0) * 5
  const hMountain = baseHeight + 50 + peaksValleys * 80
  const hPeak = hMountain + isPeak * 40

  let height = hNormal
  
  if (isDepression > 0) height = height * (1 - isDepression) + hDepression * isDepression
  if (isPlain > 0) height = height * (1 - isPlain) + hPlain * isPlain
  if (isHill > 0) height = height * (1 - isHill) + hHill * isHill
  if (isPlateau > 0) height = height * (1 - isPlateau) + hPlateau * isPlateau
  if (isMountain > 0) height = height * (1 - isMountain) + hMountain * isMountain
  if (isPeak > 0.1) height = height * (1 - isPeak) + hPeak * isPeak

  return Math.floor(height)
}

for (const biomeName in biomeLayers) {
  const biome = biomeLayers[biomeName]

  for (const layerName in biome) {
    const layer = biome[layerName]

    if (Array.isArray(layer)) {
      let acc = 0

      biome[layerName] = layer.map(entry => {
        acc += entry.threshold

        return {
          threshold: acc,
          raw: unparseBlock(entry)
        }
      })
    }

    else {
      biome[layerName] = {
        raw: unparseBlock(layer)
      }
    }
  }
}

function pickType(layer) {
    if(!Array.isArray(layer)) return layer.raw
    else {
            const chance = Math.random()
            for(const l of layer){
                            if(chance <= l.threshold) return l.raw
            }
    }
    
    return layer[layer.length - 1].raw
}

function generateChunk(cx, cz) {
  const key = cx + "," + cz

  if (chunks.has(key)) return
  chunks.set(key, 1)
  
  const heightMap = new Array(chunkSize * chunkSize)
  
  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const wx = cx * chunkSize + x
      const wz = cz * chunkSize + z
      
      heightMap[x + z * chunkSize] = Math.max(1, getHeight(wx, wz))
      
      const temp = fbm(wx * biomeScale, wz * biomeScale, 2, 0.5, 2.0)
      const humidity = fbm((wx + 8000) * biomeScale, (wz + 8000) * biomeScale, 2, 0.5, 2.0)

      biome[wz] ??= []
      biome[wz][wx] = encodeBiome(temp, humidity)
      
      const isDesert = temp > 0.6 && humidity < 0.4
      const isCold = temp < 0.3
      
      let chunkBiome = isDesert ? biomeLayers.desert : biomeLayers.grassland

      let h = heightMap[x + z * chunkSize]

      for (let y = 0; y < h; y++) {
        if (y < 0 || y >= worldHeight) continue
        
        if (y >= 200) chunkBiome = biomeLayers.peak
        else if (y >= 120) chunkBiome = biomeLayers.mountain
        let type
        
        if (y === h - 1) type = pickType(chunkBiome.surface)
        else if (y > h - 3) type = pickType(chunkBiome.bellowSurface)
        else if (y > h - 4) type = pickType(chunkBiome.soil)
        else type = pickType(chunkBiome.rock)
        
        if (!world[wx]) world[wx] = []
        if (!world[wx][y]) world[wx][y] = []

        world[wx][y][wz] = type
      }
    }
  }
}