// scene setup
let sens = 0.003
let state = "startScreen"
let renderDistance = 32

const debug = document.getElementById("debug")
let devText = ""

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 5, 20)

const renderer = new THREE.WebGLRenderer({ antialias: true })
document.body.appendChild(renderer.domElement)

camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()
renderer.setSize(window.innerWidth, window.innerHeight)

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const textureLoader = new THREE.TextureLoader()