// block definitions

// "id,data"
const blockTypes = {
  "1,0": "grass",
  "1,1": "grassClover",
  "1,2": "grassFlower1",
  "1,3": "grassFlower2",
  "1,4": "grassFlower3",
  "2,0": "dirt",
  "2,1": "grassCover",
  "3,0": "stone"
}

// "class"

// [ {{ id: 1, amount: 1, mass: 100, size: 1 }, chance: 0.5 }]

const blockPhysics = {
  1: { friction: 0.55, weight: 1100*gravity, support: 770*gravity, elasticity: 0.35, breakTime: 300, breakMethod: "dig" },
  2: { friction: 0.75, weight: 1500*gravity, support: 1245*gravity, elasticity: 0.2, breakTime: 600, breakMethod: "dig" },
  3: { friction: 0.9, weight: 2600*gravity, support: 2392*gravity, elasticity: 0.05, breakTime: 1200, breakMethod: "quarry" }
}

const materials = {
  grass: new THREE.MeshLambertMaterial({ map: blockTextures.grass }),
  grassClover: new THREE.MeshLambertMaterial({ map: blockTextures.grassClover }),
  grassFlower1: new THREE.MeshLambertMaterial({ map: blockTextures.grassFlower1 }),
  grassFlower2: new THREE.MeshLambertMaterial({ map: blockTextures.grassFlower2 }),
  grassFlower3: new THREE.MeshLambertMaterial({ map: blockTextures.grassFlower3 }),
  dirt: new THREE.MeshLambertMaterial({ map: blockTextures.dirt }),
  grassCover: new THREE.MeshLambertMaterial({ map: blockTextures.grassCover }),
  stone: new THREE.MeshLambertMaterial({ map: blockTextures.stone })
}

const geometries = {
    0: { geometry: new THREE.BoxGeometry(blockSize, blockSize, blockSize), w: blockSize, h: blockSize, d: blockSize },
    1: { geometry: new THREE.BoxGeometry(blockSize, blockSize, blockSize), w: blockSize, h: blockSize, d: blockSize }
}