// render elements
const frustum = new THREE.Frustum()
const projScreenMatrix = new THREE.Matrix4()

const tempBox = new THREE.Box3()
const tempMin = new THREE.Vector3()
const tempMax = new THREE.Vector3()

const nightColor = new THREE.Color(0x0b0c2a)
const dawnColor = new THREE.Color(0xff8ccf)
const dayColor = new THREE.Color(0x87ceeb)
const sunsetColor = new THREE.Color(0xffa500)

const skyColor = new THREE.Color()

const skyGeo = new THREE.SphereGeometry(5000, 32, 32)

const skyMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  vertexColors: false,
  fog: false
})

const sky = new THREE.Mesh(skyGeo, skyMat)
scene.add(sky)

const sunTexture = textureLoader.load('https://threejs.org/examples/textures/sprites/sun.png')
const moonTexture = textureLoader.load('https://threejs.org/examples/textures/sprites/moon.png')

const sunSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: sunTexture, transparent: true })
)

const moonSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: moonTexture, transparent: true })
)

sunSprite.scale.set(500, 500, 1)
moonSprite.scale.set(400, 400, 1)

sunSprite.material.depthWrite = false
sunSprite.material.depthTest = false

moonSprite.material.depthWrite = false
moonSprite.material.depthTest = false

sunSprite.renderOrder = 999
moonSprite.renderOrder = 999

sunSprite.frustumCulled = false
moonSprite.frustumCulled = false

scene.add(sunSprite)
scene.add(moonSprite)

function getSkyColor(daytime) {

  let tDay = (daytime + 0.25) % 1

  if (tDay < 0.25) {
    skyColor.copy(nightColor)

  } else if (tDay < 0.292) {
    let t = (tDay - 0.25) / (0.292 - 0.25)
    t = t * t * (3 - 2 * t)
    skyColor.copy(nightColor).lerp(dawnColor, t)

  } else if (tDay < 0.333) {
    let t = (tDay - 0.292) / (0.333 - 0.292)
    t = t * t * (3 - 2 * t)
    skyColor.copy(dawnColor).lerp(dayColor, t)

  } else if (tDay < 0.667) {
    skyColor.copy(dayColor)

  } else if (tDay < 0.708) {
    let t = (tDay - 0.667) / (0.708 - 0.667)
    t = t * t * (3 - 2 * t)
    skyColor.copy(dayColor).lerp(sunsetColor, t)

  } else if (tDay < 0.75) {
    let t = (tDay - 0.708) / (0.75 - 0.708)
    t = t * t * (3 - 2 * t)
    skyColor.copy(sunsetColor).lerp(nightColor, t)

  } else {
    skyColor.copy(nightColor)
  }

  return skyColor
}

const materialList = Object.values(materials)
const materialKeys = Object.keys(materials)
const matToIndex = {}
materialKeys.forEach((k, i) => matToIndex[k] = i)

function processQueues() {
  if (chunkQueue.length > 0) {
    for (let i = 0; i < chunksPerFrame; i++) {
      const task = chunkQueue.shift()
      if (task) {
        generateChunk(task.cx, task.cz)
        chunkMeshQueue.push(task)
      }
    }
  }

  if (chunkMeshQueue.length > 0) {
    const task = chunkMeshQueue.shift()
    const key = task.cx + "," + task.cz
    
    if (!chunkMeshes.has(key)) {
      const mesh = buildChunkMesh(task.cx, task.cz)
      if (mesh) {
        blocksGroup.add(mesh)
        chunkMeshes.set(key, mesh)
      } else {
        chunkMeshes.set(key, null)
      }
    }
  }
}


const chunkMeshes = new Map()
const blocksGroup = new THREE.Group()
scene.add(blocksGroup)

function getBlockType(wx, wy, wz) {
  if (wy < 0 || wy >= worldHeight) return null
  const row = world[wx]
  if (!row) return null
  const col = row[wy]
  if (!col) return null
  const b = col[wz]
  if (!b) return null
  const parsed = parseBlock(b)
  return blockTypes[`${parsed.id},${parsed.data}`]
}

function buildChunkMesh(cx, cz) {
  const startX = cx * chunkSize
  const startZ = cz * chunkSize
  
  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  const groups = {}
  let indexCount = 0

  const dims = [chunkSize, worldHeight, chunkSize]
  
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3
    const v = (d + 2) % 3
    const x = [0, 0, 0]
    const q = [0, 0, 0]
    const mask = new Int32Array(dims[u] * dims[v])
    
    q[d] = 1
    
    for (x[d] = -1; x[d] < dims[d];) {
      let n = 0
      for (x[v] = 0; x[v] < dims[v]; x[v]++) {
        for (x[u] = 0; x[u] < dims[u]; x[u]++) {
          const b1 = getBlockType(startX + x[0], x[1], startZ + x[2])
          const b2 = getBlockType(startX + x[0] + q[0], x[1] + q[1], startZ + x[2] + q[2])
          
          const m1 = b1 ? matToIndex[b1] + 1 : 0
          const m2 = b2 ? matToIndex[b2] + 1 : 0
          
          if (m1 === m2) {
            mask[n++] = 0
          } else if (m1) {
            mask[n++] = m1
          } else {
            mask[n++] = -m2
          }
        }
      }
      x[d]++
      
      n = 0
      for (let j = 0; j < dims[v]; j++) {
        for (let i = 0; i < dims[u];) {
          const c = mask[n]
          if (c !== 0) {
            let w, h
            for (w = 1; i + w < dims[u] && mask[n + w] === c; w++) {}
            let done = false
            for (h = 1; j + h < dims[v]; h++) {
              for (let k = 0; k < w; k++) {
                if (mask[n + k + h * dims[u]] !== c) {
                  done = true
                  break
                }
              }
              if (done) break
            }
            
            const isFront = c > 0
            const matIdx = Math.abs(c) - 1
            
            x[u] = i
            x[v] = j
            
            const du = [0, 0, 0]
            du[u] = w
            const dv = [0, 0, 0]
            dv[v] = h
            
            const bl = [x[0], x[1], x[2]]
            const br = [x[0] + du[0], x[1] + du[1], x[2] + du[2]]
            const tr = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]]
            const tl = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]]
            
            const bLeft = [bl[0] * blockSize, bl[1] * blockSize, bl[2] * blockSize]
            const bRight = [br[0] * blockSize, br[1] * blockSize, br[2] * blockSize]
            const tRight = [tr[0] * blockSize, tr[1] * blockSize, tr[2] * blockSize]
            const tLeft = [tl[0] * blockSize, tl[1] * blockSize, tl[2] * blockSize]
            
            if (isFront) {
              positions.push(...bLeft, ...bRight, ...tRight, ...tLeft)
            } else {
              positions.push(...bLeft, ...tLeft, ...tRight, ...bRight)
            }
            
            const norm = [0, 0, 0]
            norm[d] = isFront ? 1 : -1
            normals.push(...norm, ...norm, ...norm, ...norm)

             const tileSize = 1

             const sizeU = du[u] || dv[u]
             const sizeV = du[v] || dv[v]

             const u1 = sizeU * tileSize
             const v1 = sizeV * tileSize

             if (d === 0) {
                  if (isFront) {
                       uvs.push(0, 0, 0, u1, v1, u1, v1, 0)
                  } else {
                       uvs.push(0, 0, v1, 0, v1, u1, 0, u1)
                  }
             } else {
                  if (isFront) {
                       uvs.push(0, 0, u1, 0, u1, v1, 0, v1)
                  } else {
                       uvs.push(0, 0, 0, v1, u1, v1, u1, 0)
                }
             }


            
            indices.push(indexCount, indexCount + 1, indexCount + 2, indexCount, indexCount + 2, indexCount + 3)
            
            if (!groups[matIdx]) groups[matIdx] = []
            groups[matIdx].push({ start: indices.length - 6, count: 6 })
            
            indexCount += 4
            
            for (let l = 0; l < h; l++) {
              for (let k = 0; k < w; k++) {
                mask[n + k + l * dims[u]] = 0
              }
            }
            i += w
            n += w
          } else {
            i++
            n++
          }
        }
      }
    }
  }
  
  if (positions.length === 0) return null
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  
  const finalGroups = []
  for (const key in groups) {
    const grp = groups[key]
    const matId = parseInt(key)
    let currentStart = grp[0].start
    let currentCount = grp[0].count
    for (let i = 1; i < grp.length; i++) {
      if (grp[i].start === currentStart + currentCount) {
        currentCount += grp[i].count
      } else {
        finalGroups.push({ start: currentStart, count: currentCount, materialIndex: matId })
        currentStart = grp[i].start
        currentCount = grp[i].count
      }
    }
    finalGroups.push({ start: currentStart, count: currentCount, materialIndex: matId })
  }
  
  finalGroups.forEach(g => geometry.addGroup(g.start, g.count, g.materialIndex))
  
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  
  const mesh = new THREE.Mesh(geometry, materialList)
  mesh.position.set(startX * blockSize, 0, startZ * blockSize)
  
  return mesh
}

function renderBlocks() {
  const playerCellX = Math.floor(player.x / blockSize)
  const playerCellZ = Math.floor(player.z / blockSize)
  
  const pcx = Math.floor(playerCellX / chunkSize)
  const pcz = Math.floor(playerCellZ / chunkSize)
  
  const viewDist = Math.max(1, Math.ceil(renderDistance / chunkSize))
  
  for (let z = -viewDist; z <= viewDist; z++) {
    for (let x = -viewDist; x <= viewDist; x++) {
      const cx = pcx + x
      const cz = pcz + z
      const key = cx + "," + cz
      
      if (!chunkMeshes.has(key) && chunks.has(key)) {
        const mesh = buildChunkMesh(cx, cz)
        if (mesh) {
          blocksGroup.add(mesh)
          chunkMeshes.set(key, mesh)
        } else {
          chunkMeshes.set(key, null)
        }
      }
    }
  }
  
  blocksGroup.children.forEach(mesh => {
    tempBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
    mesh.visible = frustum.intersectsBox(tempBox)
  })
}

scene.background = new THREE.Color(0x000000)

// render
function render() {
  const skyCol = getSkyColor(daytime)
  sky.material.color.copy(skyCol)
  scene.background = skyCol

  camera.updateMatrix()
  camera.updateMatrixWorld()

  projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  )

  frustum.setFromProjectionMatrix(projScreenMatrix)

  renderBlocks()
  
  renderer.render(scene, camera)
}