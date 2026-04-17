// inputs
let isTouching = false
let lastX = 0
let lastY = 0

let yaw = 0
let pitch = 0

document.addEventListener("touchstart", (e) => {
  isTouching = true
  lastX = e.touches[0].clientX
  lastY = e.touches[0].clientY
})

document.addEventListener("touchmove", (e) => {
  if (!isTouching) return

  const touch = e.touches[0]

  let deltaX = touch.clientX - lastX
  let deltaY = touch.clientY - lastY

  lastX = touch.clientX
  lastY = touch.clientY

  yaw -= deltaX * sens
  pitch -= deltaY * sens

  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

  camera.rotation.order = "YXZ"
  camera.rotation.y = yaw
  camera.rotation.x = pitch
})

document.addEventListener("touchend", () => {
  isTouching = false
})

const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

let keys = { up: false, down: false, right: false, left: false, jump: false, build: false, destroy: false }

up.ontouchstart = () => keys.up = true
up.ontouchend = () => keys.up = false

down.ontouchstart = () => keys.down = true
down.ontouchend = () => keys.down = false

left.ontouchstart = () => keys.left = true
left.ontouchend = () => keys.left = false

right.ontouchstart = () => keys.right = true
right.ontouchend = () => keys.right = false

jump.ontouchstart = () => keys.jump = true
jump.ontouchend = () => keys.jump = false

build.ontouchstart = () => keys.build = true
build.ontouchend = () => keys.build = false

destroy.ontouchstart = () => keys.destroy = true
destroy.ontouchend = () => keys.destroy = false

function start() {
  startscreen.id = "startscreen-inactive"
  state = "game"
  updateHotbar()
}

function ability() {}

function pauseGame() {
  state = state === "game" ? "paused" : "game"
}