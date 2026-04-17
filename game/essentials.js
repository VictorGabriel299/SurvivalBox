// essentials
function clamp(min,max,val){
    return Math.min(max, Math.max(min,val))
}

function sort(min,max){
    return Math.floor(Math.random() * (max - min)) + min
}

function distance(a,b){
    return Math.abs(Math.hypot(a.x,a.y,a.z) - Math.hypot(b.x,b.y,b.z))
}

function vectorSum(vec1,vec2){
    return Math.hypot((vec1.x + vec2.x), (vec1.y + vec2.y), (vec1.z + vec2.z))
}

function worldToChunk(x, z) {
  const cx = Math.floor(x / chunkSize)
  const cz = Math.floor(z / chunkSize)

  const lx = ((x % chunkSize) + chunkSize) % chunkSize
  const lz = ((z % chunkSize) + chunkSize) % chunkSize

  return { cx, cz, lx, lz }
}

function setBlock(x, y, z, type) {
  if (y < 0 || y >= worldHeight) return

  if (!world[x]) world[x] = []
  if (!world[x][y]) world[x][y] = []

  world[x][y][z] = type ? unparseBlock(type) : 0
}

function refreshChunk(x,z){
  const cx = Math.floor(x / chunkSize)
  const cz = Math.floor(z / chunkSize)

  const localX = ((x % chunkSize) + chunkSize) % chunkSize
  const localZ = ((z % chunkSize) + chunkSize) % chunkSize

  const update = (cx,cz) => {
    const key = cx + "," + cz
    if (!chunkMeshes.has(key)) return

    const oldMesh = chunkMeshes.get(key)
    if (oldMesh) blocksGroup.remove(oldMesh)

    chunkMeshQueue.push({ cx, cz })
    chunkMeshes.delete(key)
  }

  update(cx, cz)

  if (localX === 0) update(cx - 1, cz)
  if (localX === chunkSize - 1) update(cx + 1, cz)

  if (localZ === 0) update(cx, cz - 1)
  if (localZ === chunkSize - 1) update(cx, cz + 1)
}

function refreshBlock(x, y, z) {
  const cx = Math.floor(x / chunkSize)
  const cz = Math.floor(z / chunkSize)
  
  const localX = ((x % chunkSize) + chunkSize) % chunkSize
  const localZ = ((z % chunkSize) + chunkSize) % chunkSize
  
  const targets = [[cx, cz]]
  
  if (localX === 0) targets.push([cx - 1, cz])
  if (localX === chunkSize - 1) targets.push([cx + 1, cz])
  if (localZ === 0) targets.push([cx, cz - 1])
  if (localZ === chunkSize - 1) targets.push([cx, cz + 1])
  
  for (const [tx, tz] of targets) {
    const key = tx + "," + tz
    const oldMesh = chunkMeshes.get(key)
    const newMesh = buildChunkMesh(tx, tz)
    
    if (newMesh) {
      newMesh.geometry.computeBoundingSphere()
      blocksGroup.add(newMesh)
      chunkMeshes.set(key, newMesh)
    }

    if (oldMesh) {
      blocksGroup.remove(oldMesh)
      oldMesh.geometry.dispose()
      if (oldMesh.material) {
        if (Array.isArray(oldMesh.material)) {
          oldMesh.material.forEach(m => m.dispose())
        } else {
          oldMesh.material.dispose()
        }
      }
    }
    
    if (!newMesh && oldMesh) {
      chunkMeshes.delete(key)
    }
  }
}



function getTargetBlock(maxDist = 5) {
  const origin = camera.position.clone()
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)

  let x = Math.floor(origin.x / blockSize)
  let y = Math.floor(origin.y / blockSize)
  let z = Math.floor(origin.z / blockSize)

  const stepX = Math.sign(dir.x)
  const stepY = Math.sign(dir.y)
  const stepZ = Math.sign(dir.z)

  const tDeltaX = dir.x !== 0 ? Math.abs(blockSize / dir.x) : Infinity
  const tDeltaY = dir.y !== 0 ? Math.abs(blockSize / dir.y) : Infinity
  const tDeltaZ = dir.z !== 0 ? Math.abs(blockSize / dir.z) : Infinity

  const nextBoundaryX = (x + (stepX > 0 ? 1 : 0)) * blockSize
  const nextBoundaryY = (y + (stepY > 0 ? 1 : 0)) * blockSize
  const nextBoundaryZ = (z + (stepZ > 0 ? 1 : 0)) * blockSize

  let tMaxX = dir.x !== 0 ? (nextBoundaryX - origin.x) / dir.x : Infinity
  let tMaxY = dir.y !== 0 ? (nextBoundaryY - origin.y) / dir.y : Infinity
  let tMaxZ = dir.z !== 0 ? (nextBoundaryZ - origin.z) / dir.z : Infinity

  const maxT = maxDist * blockSize

  while (true) {
    const block = world[x]?.[y]?.[z]
    if (block && block !== 0) {
      return { x, y, z }
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX
        if (tMaxX > maxT) break
        tMaxX += tDeltaX
      } else {
        z += stepZ
        if (tMaxZ > maxT) break
        tMaxZ += tDeltaZ
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY
        if (tMaxY > maxT) break
        tMaxY += tDeltaY
      } else {
        z += stepZ
        if (tMaxZ > maxT) break
        tMaxZ += tDeltaZ
      }
    }
  }

  return null
}

function unparseBlock(block) {
  let n = BigInt(0)
  n |= BigInt(block.id & 0xFFFF) << 52n
  n |= BigInt(block.class & 0x3FF) << 42n
  n |= BigInt((block.data ?? 0) & 0xFF) << 34n
  n |= BigInt((block.geo ?? 0) & 0x3FF) << 24n
  n |= BigInt((block.v1 ?? 0) & 0xFF) << 16n
  n |= BigInt((block.v2 ?? 0) & 0xFF) << 8n
  n |= BigInt((block.v3 ?? 0) & 0xFF)
  return n
}

function parseBlock(n) {
  n = BigInt(n)
  if(n === undefined || n === NaN) return
  return {
    id: Number((n >> 52n) & 0xFFFFn),
    class: Number((n >> 42n) & 0x3FFn),
    data: Number((n >> 34n) & 0xFFn) ?? 0,
    geo: Number((n >> 24n) & 0x3FFn) ?? 0,
    v1: Number((n >> 16n) & 0xFFn) ?? 0,
    v2: Number((n >> 8n) & 0xFFn) ?? 0,
    v3: Number(n & 0xFFn) ?? 0
  }
}

const parseBlockId = (n) => Number((n >> 52n) & 0xFFFFn)
const parseBlockClass = (n) => Number((n >> 42n) & 0x3FFn)
const parseBlockData = (n) => Number((n >> 34n) & 0xFFn)
const parseBlockGeo = (n) => Number((n >> 24n) & 0x3FFn)
const parseBlockV1 = (n) => Number((n >> 16n) & 0xFFn)
const parseBlockV2 = (n) => Number((n >> 8n) & 0xFFn)
const parseBlockV3 = (n) => Number(n & 0xFFn)

function parseItem(n) {
  n = BigInt(n)
  return {
    id: Number((n >> 16n) & 0xFFFFn),
    amount: Number((n >> 14n) & 0x3n),
    mass: Number((n >> 4n) & 0x3FFn),
    size: Number((n >> 2n) & 0x3n),
    rot: Number(n & 0x3n)
  }
}

function unparseItem(item) {
  let n = 0n
  n |= BigInt(item.id & 0xFFFF) << 16n
  n |= BigInt(item.amount & 0x3) << 14n
  n |= BigInt((item.mass || 1) & 0x3FF) << 4n
  n |= BigInt((item.size ?? 0) & 0x3) << 2n
  n |= BigInt((item.rot ?? 0) & 0x3)
  return n
}

function parseTool(n) {
  n = BigInt(n)
  return {
    id: Number((n >> 26n) & 0xFFFFn),
    class: Number((n >> 22n) & 0xFn),
    material: Number((n >> 19n) & 0x7n),
    mass: Number((n >> 16n) & 0x7n),
    durability: Number((n >> 5n) & 0x7FFn),
    damage: Number(n & 0x1Fn)
  }
}

function unparseTool(tool) {
  let n = 0n
  n |= BigInt(tool.id & 0xFFFF) << 26n
  n |= BigInt(tool.class & 0xF) << 22n
  n |= BigInt(tool.material & 0x7) << 19n
  n |= BigInt((tool.mass || 1) & 0x7) << 16n
  n |= BigInt((tool.durability || 1) & 0x7FF) << 5n
  n |= BigInt((tool.damage || 1) & 0x1F)
  return n
}

function parseFood(n) {
  n = BigInt(n)
  return {
    id: Number((n >> 23n) & 0xFFFFn),
    amount: Number((n >> 21n) & 0x3n),
    mass: Number((n >> 11n) & 0x3FFn),
    size: Number((n >> 9n) & 0x3n),
    rot: Number((n >> 7n) & 0x3n),
    saturation: Number((n >> 4n) & 0x7n),
    hunger: Number(n & 0x1Fn)
  }
}

function unparseFood(food) {
  let n = 0n
  n |= BigInt(food.id & 0xFFFF) << 23n
  n |= BigInt(food.amount & 0x3) << 21n
  n |= BigInt((food.mass || 1) & 0x3FF) << 11n
  n |= BigInt((food.size ?? 0) & 0x3) << 9n
  n |= BigInt((food.rot ?? 0) & 0x3) << 7n
  n |= BigInt(food.saturation & 0x7) << 4n
  n |= BigInt(food.hunger & 0x1F)
  return n
}

function encodeBiome(temp, humidity) {
  const t = Math.floor(temp * 1000)
  const h = Math.floor(humidity * 100)

  return t * 100 + h
}

function decodeBiome(value) {
  return {
    humidity: value % 100,
    temperature: Math.floor(value / 100)
  }
}

function despawn(o) {
  const index = items.indexOf(o)

  if (index !== -1) {
    if (o.mesh) {
      scene.remove(o.mesh)
    }

    items.splice(index, 1)
  }
}