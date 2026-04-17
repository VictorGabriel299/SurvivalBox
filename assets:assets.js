// textures, geometries & animations

const blockTextures = {
  grass: textureLoader.load('./blocks/grass/default.png'),
  grassFlower1: textureLoader.load('./blocks/grass/flower1.png'),
  grassFlower2: textureLoader.load('./blocks/grass/flower2.png'),
  grassFlower3: textureLoader.load('./blocks/grass/flower3.png'),
  grassClover: textureLoader.load('./blocks/grass/clover.png'),
  grassCover: textureLoader.load('./blocks/grass/cover.png'),
  dirt: textureLoader.load('./blocks/dirt.png'),
  stone: textureLoader.load('./blocks/stone.png')
}

Object.values(blockTextures).forEach(t => {
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
})

const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize)

const itemSprites = {
  item: {
    1: textureLoader.load("./items/pebble.png")
  },

  tool: {
    1: textureLoader.load("tool1.png"),
    2: textureLoader.load("tool2.png")
  },

  food: {
    1: textureLoader.load("food1.png"),
    2: textureLoader.load("food2.png")
  }
}