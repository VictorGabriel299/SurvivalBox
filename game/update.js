// elements

const ambient = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambient)

const sun = new THREE.DirectionalLight(0xffffff, 1)
sun.position.set(100, 200, 100)
scene.add(sun)

let player = {
  x: -5000,
  y: 5000,
  z: -5000,
  vx: 0,
  vy: 0,
  vz: 0,
  acceleration: 0.5,
  jumpStrength: 32.5,
  maxSpeed: 12,
  w: 16,
  h: 56,
  d: 16,
  box: {},
  prevFrame: {
        x: Infinity,
        y: Infinity,
        z: Infinity
  },
  onGround: false,
  facing:"north",
  mass: 80,
  elasticity: 1
}

player.box = {
    min: {
            x: player.x - player.w / 2,
            y: player.y - player.h / 2,
            z: player.z - player.d / 2
    },
    max: {
            x: player.x + player.w / 2,
            y: player.y + player.h / 2,
            z: player.z + player.d / 2
    }
}

let inventory = [
null, null, null, null,
null, null, null, null
]

const hotbar = document.getElementById("hotbar")

let selectedSlot = 0

function createHand(slots, offset) {
    const handDiv = document.createElement("div")
    handDiv.className = "hand"

    slots.forEach((slot, i) => {
      if (!slot || slot.type === "locked" || slot.item === null) return

      const div = document.createElement("div")
      div.className = "slot"

      if (selectedSlot === i + offset) {
        div.classList.add("selected")
      }

      div.innerText = parseItem(slot.item)?.id ?? parseBlockId(slot.item)
      const item = slot.item
      const type = slot.type
      if(type === "block") div.innerText = parseBlockId(item)
      else if(type === "tool") div.innerText = parseTool(item)?.id
      else if(type === "food") div.innerText = parseFood(item)?.id
      else div.innerText = `${parseItem(item)?.id} (${parseItem(item)?.amount + 1})`

      div.onclick = () => {
        selectedSlot = i + offset
        updateHotbar()
      }

      handDiv.appendChild(div)
    })

    return handDiv.children.length > 0 ? handDiv : null
  }

function updateHotbar() {
  hotbar.innerHTML = ""

  const left = inventory.slice(0, 4)
  const right = inventory.slice(4, 8)

  const hasLeft = left.some(s => s && s.item !== null)
  const hasRight = right.some(s => s && s.item !== null)

  if (hasLeft) {
    const hand = createHand(left, 0)
    if (hand) hotbar.appendChild(hand)
  }

  if (hasRight) {
    const hand = createHand(right, 4)
    if (hand) hotbar.appendChild(hand)
  }
}

let items = []

// game logic

function rect(a,b){
    const minA = a.box.min
    const maxA = a.box.max
    const minB = b.box.min
    const maxB = b.box.max
    
    return (
        minA.x <= maxB.x &&
        maxA.x >= minB.x &&
        
        minA.y <= maxB.y &&
        maxA.y >= minB.y &&
        
        minA.z <= maxB.z &&
        maxA.z >= minB.z
    )
}

function collide(o) {
  const prevMin = {
    x: player.prevFrame.x - player.w / 2,
    y: player.prevFrame.y - player.h / 2,
    z: player.prevFrame.z - player.d / 2
  };

  const prevMax = {
    x: player.prevFrame.x + player.w / 2,
    y: player.prevFrame.y + player.h / 2,
    z: player.prevFrame.z + player.d / 2
  };

  const min = player.box.min;
  const max = player.box.max;
  const minO = o.box.min;
  const maxO = o.box.max;
  const elasticity = -Math.min((o.elasticity ?? 0), player.elasticity)

  if (prevMin.y >= maxO.y && min.y < maxO.y) {
    player.y = maxO.y + player.h / 2;
    player.vy *= elasticity;
    player.onGround = true;
  } 
  else if (prevMax.y <= minO.y && max.y > minO.y) {
    player.y = minO.y - player.h / 2;
    player.vy *= elasticity;
  } 
  else if (prevMax.x <= minO.x && max.x > minO.x) {
    player.x = minO.x - player.w / 2;
    player.vx *= elasticity;
  } else if (prevMin.x >= maxO.x && min.x < maxO.x) {
    player.x = maxO.x + player.w / 2;
    player.vx *= elasticity;
  } 
  else if (prevMax.z <= minO.z && max.z > minO.z) {
    player.z = minO.z - player.d / 2;
    player.vz *= elasticity;
  } else if (prevMin.z >= maxO.z && min.z < maxO.z) {
    player.z = maxO.z + player.d / 2;
    player.vz *= elasticity;
  }
}

function push(o) {
  const prevMin = {
    x: player.prevFrame.x - player.w / 2,
    y: player.prevFrame.y - player.h / 2,
    z: player.prevFrame.z - player.d / 2
  };

  const prevMax = {
    x: player.prevFrame.x + player.w / 2,
    y: player.prevFrame.y + player.h / 2,
    z: player.prevFrame.z + player.d / 2
  };

  const min = player.box.min;
  const max = player.box.max;
  const minO = o.box.min;
  const maxO = o.box.max;

  if (prevMin.y >= maxO.y && min.y < maxO.y) {
    player.y = maxO.y + player.h / 2;
    player.vy = 0;
    player.onGround = true;
  } 

  else if (max.x > minO.x && min.x < maxO.x) {
    o.x += player.vx;
  }

  else if (max.z > minO.z && min.z < maxO.z) {
    o.z += player.vz;
  }
}

function rectBlock(blockPos){
    const minBlock = { x: blockPos.x - blockSize/2, y: blockPos.y - blockSize/2, z: blockPos.z - blockSize/2 }
    const maxBlock = { x: blockPos.x + blockSize/2, y: blockPos.y + blockSize/2, z: blockPos.z + blockSize/2 }
    
    const minPlayer = { x: player.x - player.w / 2, y: player.y - player.h / 2, z: player.z - player.d / 2 }
    const maxPlayer = { x: player.x + player.w / 2, y: player.y + player.h / 2, z: player.z + player.d / 2 }
    
    return (
        minPlayer.x <= maxBlock.x &&
        maxPlayer.x >= minBlock.x &&
        
        minPlayer.y <= maxBlock.y &&
        maxPlayer.y >= minBlock.y &&
        
        minPlayer.z <= maxBlock.z &&
        maxPlayer.z >= minBlock.z
    )
}

function collideBlock(block,blockPos,blockInfo) {
  const prevMin = { x: player.prevFrame.x - player.w / 2, y: player.prevFrame.y - player.h / 2, z: player.prevFrame.z - player.d / 2 };
  const prevMax = { x: player.prevFrame.x + player.w / 2, y: player.prevFrame.y + player.h / 2, z: player.prevFrame.z + player.d / 2 };

  const min = { x: player.x - player.w / 2, y: player.y - player.h / 2, z: player.z - player.d / 2 };
  const max = { x: player.x + player.w / 2, y: player.y + player.h / 2, z: player.z + player.d / 2 };
  
  const minBlock = { x: blockPos.x - blockSize/2, y: blockPos.y - blockSize/2, z: blockPos.z - blockSize/2 }
  const maxBlock = { x: blockPos.x + blockSize/2, y: blockPos.y + blockSize/2, z: blockPos.z + blockSize/2 }
  const elasticity = -Math.min((blockPhysics[blockInfo.class]?.elasticity ?? 0), player.elasticity)

  if (prevMin.y >= maxBlock.y && min.y <= maxBlock.y) {
    player.y = maxBlock.y + player.h / 2;
    player.vy *= elasticity;
    player.onGround = true;
  } 
  else if (prevMax.y <= minBlock.y && max.y >= minBlock.y) {
    player.y = minBlock.y - player.h / 2;
    player.vy *= elasticity;
  } 
  else if (prevMax.x <= minBlock.x && max.x >= minBlock.x) {
    player.x = minBlock.x - player.w / 2;
    player.vx *= elasticity;
  } else if (prevMin.x >= maxBlock.x && min.x <= maxBlock.x) {
    player.x = maxBlock.x + player.w / 2;
    player.vx *= elasticity;
  } 
  else if (prevMax.z <= minBlock.z && max.z >= minBlock.z) {
    player.z = minBlock.z - player.d / 2;
    player.vz *= elasticity;
  } else if (prevMin.z >= maxBlock.z && min.z <= maxBlock.z) {
    player.z = maxBlock.z + player.d / 2;
    player.vz *= elasticity;
  }
}

function rectObjectWithBlock(o, blockPos) {
  const minBlock = {
    x: blockPos.x - blockSize / 2,
    y: blockPos.y - blockSize / 2,
    z: blockPos.z - blockSize / 2
  }

  const maxBlock = {
    x: blockPos.x + blockSize / 2,
    y: blockPos.y + blockSize / 2,
    z: blockPos.z + blockSize / 2
  }

  const min = { x: o.x - o.w / 2, y: o.y - o.h / 2, z: o.z - o.d / 2 }
  const max = { x: o.x + o.w / 2, y: o.y + o.h / 2, z: o.z + o.d / 2 }

  return (
    min.x <= maxBlock.x &&
    max.x >= minBlock.x &&
    min.y <= maxBlock.y &&
    max.y >= minBlock.y &&
    min.z <= maxBlock.z &&
    max.z >= minBlock.z
  )
}

function collideObjectWithBlock(o, blockPos, blockInfo) {
  const minBlock = {
    x: blockPos.x - blockSize / 2,
    y: blockPos.y - blockSize / 2,
    z: blockPos.z - blockSize / 2
  }

  const maxBlock = {
    x: blockPos.x + blockSize / 2,
    y: blockPos.y + blockSize / 2,
    z: blockPos.z + blockSize / 2
  }

  const min = {
    x: o.x - o.w / 2,
    y: o.y - o.h / 2,
    z: o.z - o.d / 2
  }

  const max = {
    x: o.x + o.w / 2,
    y: o.y + o.h / 2,
    z: o.z + o.d / 2
  }

  const elasticity = -Math.min(
    blockPhysics[blockInfo.class]?.elasticity ?? 1,
    o.elasticity ?? 1
  )
  
  const prevX = o.x - o.vx
  const prevY = o.y - o.vy
  const prevZ = o.z - o.vz
  
  const minPrev = {
    x: prevX - o.w / 2,
    y: prevY - o.h / 2,
    z: prevZ - o.d / 2
  }

  const maxPrev = {
    x: prevX + o.w / 2,
    y: prevY + o.h / 2,
    z: prevZ + o.d / 2
  }
  
  const overlapX = Math.min(
     maxPrev.x - minBlock.x,
     maxBlock.x - minPrev.x
  )
  
  const overlapY = Math.min(
     maxPrev.y - minBlock.y,
     maxBlock.y - minPrev.y
  )
  
  const overlapZ = Math.min(
     maxPrev.z - minBlock.z,
     maxBlock.z - minPrev.z
  )
  
  const minOverlap = Math.min(overlapX, overlapY, overlapZ)
  
  /* (
    min.x <= maxBlock.x &&
    max.x >= minBlock.x &&
    min.y <= maxBlock.y &&
    max.y >= minBlock.y &&
    min.z <= maxBlock.z &&
    max.z >= minBlock.z
  ) */
  
  if (overlapY <= overlapX && overlapY <= overlapZ) {
    if (maxPrev.y <= minBlock.y) {
      o.y = minBlock.y - o.h / 2
      o.vy *= elasticity
    } else if (minPrev.y >= maxBlock.y) {
      o.y = maxBlock.y + o.h / 2
      o.vy *= elasticity
    }
  } else if (overlapX <= overlapZ) {
    if (maxPrev.x <= minBlock.x) {
      o.x = minBlock.x - o.w / 2
      o.vx *= elasticity
    } else if (minPrev.x >= maxBlock.x) {
      o.x = maxBlock.x + o.w / 2
      o.vx *= elasticity
    }
  } else {
    if (maxPrev.z <= minBlock.z) {
      o.z = minBlock.z - o.d / 2
      o.vz *= elasticity
    } else if (minPrev.z >= maxBlock.z) {
      o.z = maxBlock.z + o.d / 2
      o.vz *= elasticity
    }
  }
}

function createItem(x, y, z, type, itemData, amount = 0) {

  let mesh = null
  let parsed = null

  if (type === "block") parsed = parseBlock(itemData)
  else if (type === "item") parsed = parseItem(itemData)
  else if (type === "tool") parsed = parseTool(itemData)
  else if (type === "food") parsed = parseFood(itemData)

  if (type === "block") {
    const blockName = blockTypes[`${parsed.id},${parsed.data}`]
    const material = materials[blockName]
    const geometry = geometries[parsed.geo].geometry

    mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(0.25, 0.25, 0.25)
  } 
  
  else {
    const tex = itemSprites[type]?.[parsed?.id]

    if (tex) {
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      tex.needsUpdate = true
      
      mesh = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        transparent: true
      }))

      if (type === "item") mesh.scale.set(12, 12, 1)
      else if (type === "tool") mesh.scale.set(14, 14, 1)
      else if (type === "food") mesh.scale.set(10, 10, 1)
      else mesh.scale.set(12, 12, 1)
    }
  }

  const obj = {
    x: x + (Math.random() - 0.5),
    y: y,
    z: z + (Math.random() - 0.5),

    vx: sort(-1,1),
    vy: 2.6,
    vz: sort(-1,1),
    
    w: 8,
    h: 8,
    d: 8,

    type,
    item: itemData,
    amount: amount,

    mesh,

    time: 0,
    important: false,

    box: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 }
    }
  }

  if (mesh) {
    mesh.position.set(obj.x, obj.y, obj.z)
    scene.add(mesh)
  }

  items.push(obj)

  return obj
}

function addItem(item,type,amount = 0){
    let initialAmount = amount

    if(type === "block"){
        if(inventory.every(item => item === null)){
            inventory[0] = { item: item, type: "block" }

            for(let i = 1; i < 8; i++){
                inventory[i] = { item: null, type: "locked" }
            }
            
            updateHotbar()
            return true
        }

        return false
    }

    else if(type === "tool"){
        for(let i = 0; i < 8; i += 4){
            if(inventory[i] || inventory[i+1] || inventory[i+2] || inventory[i+3]) continue

            inventory[i] = { item: item, type: "tool" }
            inventory[i+1] = { item: null, type: "locked" }
            inventory[i+2] = { item: null, type: "locked" }
            inventory[i+3] = { item: null, type: "locked" }

            updateHotbar()
            return true
        }

        return false
    }

    else if(type === "item"){
        let base = parseItem(item)
        const maxStack = base.size === 0 ? 3 : base.size === 1 ? 1 : 0
        const slotsPerItem = 2 ** base.size

        for(let i = 0; i < inventory.length; i++){
            let slot = inventory[i]
            if(!slot || slot.type !== "item") continue

            let parsed = parseItem(slot.item)

            if(parsed.id !== base.id) continue
            if(parsed.rot !== base.rot) continue
            if(parsed.amount >= maxStack) continue

            let add = Math.min(maxStack - parsed.amount, amount)

            parsed.amount += add
            amount -= add

            inventory[i].item = unparseItem(parsed)
        }

        for(let i = 0; i <= inventory.length - slotsPerItem && amount > 0; i++){
            let hasSpace = true

            for(let s = i; s < i + slotsPerItem; s++){
                if(inventory[s] !== null){
                    hasSpace = false
                    break
                }
            }

            if(!hasSpace) continue

            let add = Math.min(maxStack, amount)

            inventory[i] = {
                item: unparseItem({ ...base, amount: add }),
                type: "item"
            }

            for(let s = i + 1; s < i + slotsPerItem; s++){
                inventory[s] = { item: null, type: "locked" }
            }

            amount -= add
        }

        updateHotbar()
        return amount === 0
    }

    return false
}


// update
let gameTime = 0
let daytime = 0.25
let daylight = 0
let dayAngle = 0

let breakingBlock = null
let breakStartTime = 0

function update() {
  gameTime++
  // daytime += 0.00001167
  daytime += 0.00001167
  if (daytime > 1) daytime = 0

  dayAngle = daytime * Math.PI * 2
  daylight = Math.max(0, Math.sin(dayAngle))
  
  sun.intensity = daylight
  ambient.intensity = 0.05 + daylight * 0.4
  
  sun.position.set(
     Math.cos(dayAngle) * 300,
     Math.sin(dayAngle) * 300,
     0
  )
  
   sky.position.set(player.x, player.y, player.z)
   
   sunSprite.position.set(
     player.x + Math.cos(dayAngle) * skyDist,
     player.y + Math.sin(dayAngle) * skyDist,
     player.z
   )

   moonSprite.position.set(
     player.x + Math.cos(dayAngle + Math.PI) * skyDist,
     player.y + Math.sin(dayAngle + Math.PI) * skyDist,
     player.z
   )

  const dirX = Math.sin(yaw)
  const dirZ = Math.cos(yaw)

  const sideX = Math.sin(yaw + Math.PI / 2)
  const sideZ = Math.cos(yaw + Math.PI / 2)
  
  if (Math.abs(dirX) > Math.abs(dirZ)) {
         player.facing = dirX > 0 ? "east" : "west"
  } else {
         player.facing = dirZ > 0 ? "south" : "north"
  }

  if (keys.up) {
    player.vx -= dirX * player.acceleration
    player.vz -= dirZ * player.acceleration
  }
  if (keys.down) {
    player.vx += dirX * player.acceleration
    player.vz += dirZ * player.acceleration
  }
  if (keys.right) {
    player.vx += sideX * player.acceleration
    player.vz += sideZ * player.acceleration
  }
  if (keys.left) {
    player.vx -= sideX * player.acceleration
    player.vz -= sideZ * player.acceleration
  }

  const speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz)

  if (speed > player.maxSpeed) {
    player.vx = (player.vx / speed) * player.maxSpeed
    player.vz = (player.vz / speed) * player.maxSpeed
  }

  if(!keys.up && !keys.down && !keys.left && !keys.right) {
    player.vx = player.vx > 0 ? Math.max(0, player.vx - floorFriction) : Math.min(0, player.vx + floorFriction)
    player.vz = player.vz > 0 ? Math.max(0, player.vz - floorFriction) : Math.min(0, player.vz + floorFriction)
  }
  
  if (keys.jump && player.onGround) {
        player.vy += player.jumpStrength
  }

  player.vy += gravity
  player.vy *= airRes
  
  if (!player.onGround) {
        player.vx *= airRes
        player.vz *= airRes
  }
  
  player.x += player.vx
  player.y += player.vy
  player.z += player.vz
  
  if (keys.destroy) {
    const target = getTargetBlock()

    if (target) {

      const block = world[target.x]?.[target.y]?.[target.z]

      if (block) {

        const parsed = parseBlock(block)
        const breakTime = blockPhysics[parsed.class]?.breakTime ?? 500

        if (
          !breakingBlock ||
          breakingBlock.x !== target.x ||
          breakingBlock.y !== target.y ||
          breakingBlock.z !== target.z
        ) {
          breakingBlock = target
          breakStartTime = performance.now()
        }

        const elapsed = performance.now() - breakStartTime

        if (elapsed >= breakTime) {
          setBlock(target.x, target.y, target.z, 0)
          
          const dropItem = { id: 1, amount: 0, mass: 100, size: 1 }
          createItem(target.x * blockSize, target.y * blockSize + blockSize / 2, target.z * blockSize, "item", unparseItem(dropItem), 1)
          breakingBlock = null
          const bellowBlock = parseBlock(world[target.x]?.[target.y - 1]?.[target.z])
          if(bellowBlock.id === 2 && bellowBlock.data === 1) setBlock(target.x, target.y-1, target.z, { id: 2, class: 2 })
          
          refreshBlock(target.x, target.y, target.z)
        }
      }
    }

  } else {
    breakingBlock = null
  }
  
  player.box.min.x = player.x - player.w / 2
  player.box.max.x = player.x + player.w / 2

  player.box.min.y = player.y - player.h / 2
  player.box.max.y = player.y + player.h / 2

  player.box.min.z = player.z - player.d / 2
  player.box.max.z = player.z + player.d / 2
  
  player.onGround = false
  
  const playerCellX = Math.floor(player.x / blockSize)
  const playerCellZ = Math.floor(player.z / blockSize)
  const playerCellY = Math.floor(player.y / blockSize)
  
const belowBlock = world[playerCellX]?.[playerCellY - 1]?.[playerCellZ]

if (belowBlock) {
  floorFriction = blockPhysics[parseBlockClass(belowBlock)]?.friction || 0.01
} else {
  floorFriction = 0.01
}
  
  for(let y = playerCellY - 1; y <= playerCellY + 1; y++){
    for(let z = playerCellZ - 1; z <= playerCellZ + 1; z++){
        for(let x = playerCellX - 1; x <= playerCellX + 1; x++){

            const block = world[x]?.[y]?.[z]
            if (!block) continue
            
            const blockPos = {
               x: x * blockSize + blockSize / 2,
               y: y * blockSize + blockSize / 2,
               z: z * blockSize + blockSize / 2
             }
             const blockInfo = parseBlock(block)
            
            if(rectBlock(blockPos))collideBlock(block,blockPos,blockInfo)

        }
    }
}

for (let i = items.length - 1; i >= 0; i--) {
 const item = items[i]
 item.time++
 const dx = player.x - item.x
 const dy = player.y - item.y
 const dz = player.z - item.z

 const distSq = dx*dx + dy*dy + dz*dz
 const maxDistSq = (renderDistance * blockSize * 3) ** 2

  if (item.time >= 1080000 || (!item.important && (item.time >= 216000 || distSq >= maxDistSq))) despawn(item)
 
 item.x += item.vx
 item.y += item.vy
 item.z += item.vz
 
 item.box.min.x = item.x - item.w / 2
 item.box.max.x = item.x + item.w / 2

 item.box.min.y = item.y - item.h / 2
 item.box.max.y = item.y + item.h / 2

 item.box.min.z = item.z - item.d / 2
 item.box.max.z = item.z + item.d / 2
 
 const itemCell = { x: Math.floor(item.x / blockSize), y: Math.floor(item.y / blockSize), z: Math.floor(item.z / blockSize) }
 
 for(let y = itemCell.y - 2; y <= itemCell.y + 2; y++){
   for(let z = itemCell.z - 2; z <= itemCell.z + 2; z++){
     for(let x = itemCell.x - 2; x <= itemCell.x + 2; x++){
       const block = world[x]?.[y]?.[z]
       if(!block)continue
       
       const blockPos = {
            x: x * blockSize,
            y: y * blockSize + blockSize / 2,
            z: z * blockSize
        }
        const blockInfo = parseBlock(block)
        
        if(rectObjectWithBlock(item, blockPos)) collideObjectWithBlock(item, blockPos, blockInfo)
     }
   }
 }
 
 item.mesh.position.set(
     item.x,
     item.y,
     item.z
   )
   item.mesh.rotation.y += 0.05
   
   if(rect(player, item)) {
      const addItemFunction = addItem(item.item,item.type)
      if(addItemFunction) despawn(item)
   }
   
   item.vx = item.vx > 0 ? Math.max(0, item.vx - 0.69) : Math.min(0, item.vx + 0.14)
   item.vz = item.vz > 0 ? Math.max(0, item.vz - 0.69) : Math.min(0, item.vz + 0.14)
   
   item.vy += gravity
   item.vy *= airRes
}

    camera.position.set(player.x, player.y + player.h/2, player.z);
  
  player.prevFrame.x = player.x
  player.prevFrame.y = player.y
  player.prevFrame.z = player.z
  
  const biomeValue = biome[playerCellZ]?.[playerCellX]

let temp = 0
let humidity = 0

if (biomeValue !== undefined) {
  const decoded = decodeBiome(biomeValue)
  temp = decoded.temperature / 1000
  humidity = decoded.humidity / 100
}
  
  devText = `x: ${playerCellX}, y: ${playerCellY}, z: ${playerCellZ}

temp: ${temp.toFixed(3)}
humidity: ${humidity.toFixed(3)}

seed:${seed}`
  
  debug.innerText = devText
}