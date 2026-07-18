const MESSAGE = 'Hello there.'
const BPM = 120
const BEAT_MS = 60000 / BPM
const TOTAL_BEATS = 48
const DURATION_MS = TOTAL_BEATS * BEAT_MS

const COLORS = {
  ink: '#090909',
  paper: '#f0eee7',
  orange: '#ff4d23',
  cobalt: '#3557ff'
}

const SCENES = [
  { start: 0, end: 4, render: renderSignal, grain: 0.35 },
  { start: 4, end: 12, render: renderImpact, grain: 0.72 },
  { start: 12, end: 20, render: renderSlice, grain: 0.56 },
  { start: 20, end: 28, render: renderPanels, grain: 0.62 },
  { start: 28, end: 36, render: renderChorus, grain: 0.68 },
  { start: 36, end: 42, render: renderCollapse, grain: 0.52 },
  { start: 42, end: 48.001, render: renderResolve, grain: 0.26 }
]

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const mix = (a, b, amount) => a + (b - a) * amount
const fract = value => value - Math.floor(value)
const easeOutExpo = value => value >= 1 ? 1 : 1 - Math.pow(2, -10 * value)
const easeInOutCubic = value => value < 0.5
  ? 4 * value * value * value
  : 1 - Math.pow(-2 * value + 2, 3) / 2
const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / Math.max(0.0001, max - min))
  return x * x * (3 - 2 * x)
}
const beatPunch = beat => Math.exp(-fract(beat) * 8.5)
const halfBeatPunch = beat => Math.exp(-fract(beat * 2) * 11)

const hash = value => {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return fract(x)
}

class MotionRenderer {
  constructor (canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d')
    this.typeLayer = document.createElement('canvas')
    this.typeCtx = this.typeLayer.getContext('2d')

    if (!this.ctx || !this.typeCtx) {
      throw new Error('Canvas 2D is unavailable.')
    }

    this.width = 1
    this.height = 1
    this.scale = 1
    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
    this.grainTiles = this.createGrainTiles()
    this.grainPatterns = []
  }

  createGrainTiles () {
    const tiles = []
    for (let tileIndex = 0; tileIndex < 4; tileIndex++) {
      const tile = document.createElement('canvas')
      tile.width = 96
      tile.height = 96
      const tileCtx = tile.getContext('2d')
      const image = tileCtx.createImageData(tile.width, tile.height)

      for (let index = 0; index < image.data.length; index += 4) {
        const value = Math.floor(Math.random() * 256)
        image.data[index] = value
        image.data[index + 1] = value
        image.data[index + 2] = value
        image.data[index + 3] = 255
      }

      tileCtx.putImageData(image, 0, 0)
      tiles.push(tile)
    }
    return tiles
  }

  resize (width, height) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)

    const dpr = Math.min(window.devicePixelRatio || 1, this.width < 720 ? 1.35 : 1.5)
    const pixelBudget = this.width < 720 ? 720000 : 2500000
    this.scale = Math.min(dpr, Math.sqrt(pixelBudget / (this.width * this.height)))

    const pixelWidth = Math.max(1, Math.round(this.width * this.scale))
    const pixelHeight = Math.max(1, Math.round(this.height * this.scale))

    this.canvas.width = pixelWidth
    this.canvas.height = pixelHeight
    this.typeLayer.width = pixelWidth
    this.typeLayer.height = pixelHeight

    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    this.typeCtx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.typeCtx.imageSmoothingEnabled = true
    this.grainPatterns = this.grainTiles.map(tile => this.ctx.createPattern(tile, 'repeat'))
  }

  clearTypeLayer () {
    this.typeCtx.save()
    this.typeCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.typeCtx.clearRect(0, 0, this.typeLayer.width, this.typeLayer.height)
    this.typeCtx.restore()
  }

  updatePointer () {
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.06
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.06
  }

  present (seconds, amount) {
    this.updatePointer()

    const pattern = this.grainPatterns[Math.floor(seconds * 12) % this.grainPatterns.length]
    if (!pattern) return

    const ctx = this.ctx
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.025 + amount * 0.02
    ctx.fillStyle = pattern
    const offsetX = -Math.floor(hash(Math.floor(seconds * 19)) * 96)
    const offsetY = -Math.floor(hash(Math.floor(seconds * 23) + 4) * 96)
    ctx.translate(offsetX, offsetY)
    ctx.fillRect(0, 0, this.canvas.width + 96, this.canvas.height + 96)
    ctx.restore()
  }
}

function fill (ctx, color, width, height) {
  ctx.save()
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function drawFittedText (ctx, text, x, y, targetWidth, size, color, options = {}) {
  const alpha = options.alpha === undefined ? 1 : options.alpha
  const maxScale = options.maxScale || 5

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.strokeStyle = options.stroke || color
  ctx.lineWidth = options.lineWidth || 1
  ctx.font = `${options.style || 'normal'} ${options.weight || '400'} ${size}px "Rosario", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const measured = Math.max(1, ctx.measureText(text).width)
  const scaleX = clamp(targetWidth / measured, 0.15, maxScale)
  ctx.translate(x, y)
  ctx.scale(scaleX, options.scaleY || 1)

  if (options.outline) {
    ctx.strokeText(text, 0, 0)
  } else {
    ctx.fillText(text, 0, 0)
  }
  ctx.restore()
}

function drawRegistration (ctx, width, height, color, alpha = 0.4) {
  const margin = Math.max(22, Math.min(width, height) * 0.052)
  const length = Math.max(12, Math.min(width, height) * 0.022)
  const corners = [
    [margin, margin, 1, 1],
    [width - margin, margin, -1, 1],
    [margin, height - margin, 1, -1],
    [width - margin, height - margin, -1, -1]
  ]

  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1
  corners.forEach(([x, y, dx, dy]) => {
    ctx.beginPath()
    ctx.moveTo(x, y + dy * length)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * length, y)
    ctx.stroke()
  })
  ctx.restore()
}

function renderSignal (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const progress = clamp(beat / 4)
  const reveal = easeOutExpo(progress)
  const pulse = beatPunch(beat)
  const radius = mix(7, Math.min(w, h) * 0.28, easeInOutCubic(progress))
  const size = h * (w < 640 ? 0.18 : 0.24)

  fill(ctx, COLORS.ink, w, h)

  ctx.save()
  ctx.translate(w / 2 + renderer.pointer.x * 8, h / 2 + renderer.pointer.y * 8)
  ctx.strokeStyle = COLORS.paper
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.14 + progress * 0.36
  ctx.beginPath()
  ctx.arc(0, 0, radius + pulse * 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.moveTo(-w * 0.42, 0)
  ctx.lineTo(w * 0.42, 0)
  ctx.moveTo(0, -h * 0.34)
  ctx.lineTo(0, h * 0.34)
  ctx.stroke()
  ctx.restore()

  drawFittedText(ctx, MESSAGE, w / 2, h / 2 + size * 0.34, w * mix(0.08, 0.78, reveal), size, COLORS.paper, {
    outline: progress < 0.7,
    alpha: 0.2 + reveal * 0.8,
    lineWidth: 1.2
  })
  drawRegistration(ctx, w, h, COLORS.paper, 0.32)
}

function renderImpact (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const local = beat - 4
  const step = Math.floor(local) % 4
  const punch = beatPunch(beat)
  const attack = easeOutExpo(clamp(fract(local) * 2.8))
  const palettes = [
    [COLORS.orange, COLORS.ink],
    [COLORS.paper, COLORS.ink],
    [COLORS.cobalt, COLORS.paper],
    [COLORS.ink, COLORS.paper]
  ]
  const palette = palettes[step]
  const mobile = w < 640
  const size = h * (mobile ? 0.23 : 0.39)
  const targetWidth = mix(w * 1.42, w * 0.9, attack)
  const x = w / 2 + (hash(step + Math.floor(local / 4) * 7) - 0.5) * w * 0.14 * (1 - attack)
  const y = h / 2 + size * 0.34

  fill(ctx, palette[0], w, h)

  for (let echo = 4; echo >= 1; echo--) {
    const color = echo === 2 ? COLORS.orange : (echo === 3 ? COLORS.cobalt : palette[1])
    drawFittedText(ctx, MESSAGE, x - echo * 8 * punch, y, targetWidth + echo * w * 0.018, size, color, {
      alpha: 0.08 + echo * 0.045
    })
  }

  drawFittedText(ctx, MESSAGE, x, y, targetWidth, size, palette[1])

  ctx.save()
  ctx.fillStyle = palette[1]
  ctx.globalCompositeOperation = 'difference'
  ctx.globalAlpha = punch * 0.4
  ctx.fillRect(0, h * (0.16 + fract(local * 0.5) * 0.66), w, Math.max(2, h * 0.008))
  ctx.restore()
}

function renderSlice (renderer, beat) {
  const { ctx, typeCtx, typeLayer, width: w, height: h, scale } = renderer
  const local = beat - 12
  const punch = beatPunch(beat)
  const bands = w < 640 ? 18 : 30
  const top = h * 0.21
  const bandHeight = h * 0.58 / bands
  const displacement = (12 + punch * 52) * Math.sin(local * Math.PI)
  const size = h * (w < 640 ? 0.22 : 0.43)

  fill(ctx, COLORS.paper, w, h)
  renderer.clearTypeLayer()
  drawFittedText(typeCtx, MESSAGE, w / 2, h / 2 + size * 0.34, w * 1.06, size, COLORS.ink)

  for (let index = 0; index < bands; index++) {
    const y = top + index * bandHeight
    const direction = index % 2 === 0 ? 1 : -1
    const noise = (hash(index * 1.7 + Math.floor(local)) - 0.5) * 1.5
    const offset = direction * displacement * (0.25 + Math.abs(noise))
    const sourceY = Math.max(0, Math.floor(y * scale))
    const sourceHeight = Math.ceil((bandHeight + 1) * scale)

    ctx.drawImage(
      typeLayer,
      0,
      sourceY,
      typeLayer.width,
      sourceHeight,
      offset,
      y,
      w,
      bandHeight + 1
    )
  }

  const markerX = mix(w * 0.08, w * 0.92, fract(local / 4))
  ctx.save()
  ctx.strokeStyle = COLORS.cobalt
  ctx.globalAlpha = 0.68
  ctx.beginPath()
  ctx.moveTo(markerX, h * 0.15)
  ctx.lineTo(markerX, h * 0.85)
  ctx.stroke()
  ctx.restore()
}

function renderPanels (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const local = beat - 20
  const punch = beatPunch(beat)
  const mobile = w < 640
  const panelCount = mobile ? 4 : 7
  const panelWidth = w / panelCount
  const size = h * (mobile ? 0.21 : 0.36)

  fill(ctx, COLORS.cobalt, w, h)

  for (let index = 0; index < panelCount; index++) {
    const x = index * panelWidth
    const direction = index % 2 === 0 ? 1 : -1
    const shift = direction * (18 + punch * panelWidth * 0.32) * Math.sin(local * Math.PI)

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, 0, panelWidth + 1, h)
    ctx.clip()
    drawFittedText(ctx, MESSAGE, w / 2 + shift, h / 2 + size * 0.34, w * 0.88, size, COLORS.paper)
    ctx.restore()
  }

  if (local > 5) {
    const lock = easeOutExpo(clamp((local - 5) / 1.2))
    drawFittedText(ctx, MESSAGE, w / 2 - (1 - lock) * w * 0.32, h / 2 + size * 0.34, w * 0.86, size, COLORS.orange, { alpha: 0.42 })
    drawFittedText(ctx, MESSAGE, w / 2 + (1 - lock) * w * 0.32, h / 2 + size * 0.34, w * 0.86, size, COLORS.paper, { alpha: lock })
  }
}

function renderChorus (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const local = beat - 28
  const step = Math.floor(local)
  const punch = halfBeatPunch(local)
  const gap = Math.max(5, Math.min(w, h) * 0.008)
  const margin = Math.max(22, Math.min(w, h) * 0.052)
  const innerW = w - margin * 2
  const innerH = h - margin * 2
  const cellW = (innerW - gap) / 2
  const cellH = (innerH - gap) / 2
  const backgrounds = [COLORS.ink, COLORS.paper, COLORS.orange, COLORS.cobalt]
  const foregrounds = [COLORS.paper, COLORS.ink, COLORS.ink, COLORS.paper]

  fill(ctx, COLORS.ink, w, h)

  for (let index = 0; index < 4; index++) {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = margin + column * (cellW + gap)
    const y = margin + row * (cellH + gap)
    const palette = (step + index) % 4

    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, cellW, cellH)
    ctx.clip()
    ctx.fillStyle = backgrounds[palette]
    ctx.fillRect(x, y, cellW, cellH)

    const direction = index % 2 === 0 ? 1 : -1
    const offset = direction * punch * cellW * 0.1
    drawFittedText(ctx, MESSAGE, x + cellW / 2 + offset, y + cellH * 0.6, cellW * 0.86, cellH * 0.28, foregrounds[palette], {
      maxScale: 5
    })
    ctx.restore()
  }
}

function renderCollapse (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const local = beat - 36
  const progress = clamp(local / 6)
  const punch = beatPunch(beat)
  const rings = w < 640 ? 7 : 11

  fill(ctx, COLORS.ink, w, h)

  ctx.save()
  ctx.translate(w / 2 + renderer.pointer.x * 9, h / 2 + renderer.pointer.y * 9)
  ctx.rotate((1 - progress) * 0.055 * Math.sin(local * Math.PI))

  for (let index = rings; index >= 0; index--) {
    const depth = index / rings
    const travel = fract(depth + progress * 1.25)
    const scale = mix(0.08, 1.48, travel)
    const alpha = Math.sin(travel * Math.PI) * 0.5
    const color = index % 4 === 0 ? COLORS.orange : (index % 3 === 0 ? COLORS.cobalt : COLORS.paper)
    const size = h * 0.12 * scale

    drawFittedText(ctx, MESSAGE, 0, size * 0.34, w * scale, size, color, {
      outline: true,
      lineWidth: Math.max(0.7, 1.3 * scale),
      alpha,
      maxScale: 6
    })
  }
  ctx.restore()

  const collapse = smoothstep(0.78, 1, progress)
  ctx.save()
  ctx.fillStyle = COLORS.paper
  ctx.globalAlpha = collapse
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, mix(17 + punch * 7, 2.5, collapse), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function renderResolve (renderer, beat) {
  const { ctx, width: w, height: h } = renderer
  const local = beat - 42
  const progress = clamp(local / 3.2)
  const reveal = easeOutExpo(progress)
  const mobile = w < 640
  const size = h * (mobile ? 0.18 : 0.25)
  const targetWidth = w * (mobile ? 0.84 : 0.78)
  const baseline = h / 2 + size * 0.34

  fill(ctx, COLORS.paper, w, h)

  ctx.save()
  const revealWidth = w * reveal
  ctx.beginPath()
  ctx.rect((w - revealWidth) / 2, 0, revealWidth, h)
  ctx.clip()
  drawFittedText(ctx, MESSAGE, w / 2, baseline + (1 - reveal) * h * 0.12, targetWidth, size, COLORS.ink)
  ctx.restore()

  ctx.save()
  ctx.fillStyle = COLORS.orange
  const ruleWidth = targetWidth * smoothstep(0.28, 0.86, progress)
  ctx.fillRect((w - ruleWidth) / 2, baseline + size * 0.2, ruleWidth, mobile ? 4 : 6)
  ctx.restore()

  drawRegistration(ctx, w, h, COLORS.ink, reveal * 0.3)
}

class MotionSequence {
  constructor () {
    this.stage = document.querySelector('.motion-stage')
    this.canvas = document.querySelector('.motion-canvas')
    this.toggle = document.querySelector('[data-motion-toggle]')
    this.renderer = new MotionRenderer(this.canvas)
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.running = false
    this.suspended = false
    this.elapsed = 0
    this.startTime = 0
    this.frame = 0

    this.bindEvents()
    this.resize()
  }

  bindEvents () {
    this.toggle.addEventListener('click', () => {
      if (this.running) {
        this.pause()
      } else {
        const from = this.elapsed >= DURATION_MS ? 0 : this.elapsed
        this.play(from)
      }
    })

    this.canvas.addEventListener('pointermove', event => {
      const bounds = this.stage.getBoundingClientRect()
      this.renderer.pointer.targetX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2
      this.renderer.pointer.targetY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2
    }, { passive: true })

    this.canvas.addEventListener('pointerleave', () => {
      this.renderer.pointer.targetX = 0
      this.renderer.pointer.targetY = 0
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.running) {
        this.elapsed = (performance.now() - this.startTime) % DURATION_MS
        cancelAnimationFrame(this.frame)
        this.running = false
        this.suspended = true
      } else if (!document.hidden && this.suspended) {
        this.suspended = false
        this.running = true
        this.startTime = performance.now() - this.elapsed
        this.frame = requestAnimationFrame(time => this.tick(time))
      }
    })

    const handleMotionPreference = event => {
      if (!event.matches) return
      cancelAnimationFrame(this.frame)
      this.running = false
      this.suspended = false
      this.elapsed = DURATION_MS
      this.setControlState(false)
      this.renderAt(DURATION_MS)
    }

    if (this.motionQuery.addEventListener) {
      this.motionQuery.addEventListener('change', handleMotionPreference)
    } else {
      this.motionQuery.addListener(handleMotionPreference)
    }

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.stage)
    } else {
      window.addEventListener('resize', () => this.resize(), { passive: true })
    }
  }

  resize () {
    const bounds = this.stage.getBoundingClientRect()
    this.renderer.resize(bounds.width, bounds.height)
    this.renderAt(this.elapsed >= DURATION_MS ? DURATION_MS : this.elapsed)
  }

  start () {
    if (this.motionQuery.matches) {
      this.elapsed = DURATION_MS
      this.renderAt(DURATION_MS)
      this.setControlState(false)
      return
    }
    this.play(0)
  }

  play (from = 0) {
    cancelAnimationFrame(this.frame)
    this.elapsed = clamp(from, 0, DURATION_MS - 1)
    this.startTime = performance.now() - this.elapsed
    this.running = true
    this.suspended = false
    this.setControlState(true)
    this.renderAt(this.elapsed)
    this.frame = requestAnimationFrame(time => this.tick(time))
  }

  pause () {
    if (this.running) {
      this.elapsed = (performance.now() - this.startTime) % DURATION_MS
    }
    cancelAnimationFrame(this.frame)
    this.running = false
    this.suspended = false
    this.setControlState(false)
    this.renderAt(this.elapsed)
  }

  setControlState (playing) {
    this.toggle.dataset.state = playing ? 'playing' : 'paused'
    this.toggle.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation')
  }

  tick (time) {
    if (!this.running) return

    const rawElapsed = time - this.startTime
    this.elapsed = rawElapsed % DURATION_MS

    try {
      this.renderAt(this.elapsed)
    } catch (error) {
      console.error('Animation stopped.', error)
      cancelAnimationFrame(this.frame)
      this.running = false
      this.setControlState(false)
      this.stage.classList.remove('is-ready')
      return
    }

    this.frame = requestAnimationFrame(nextTime => this.tick(nextTime))
  }

  renderAt (elapsed) {
    const safeElapsed = clamp(elapsed, 0, DURATION_MS)
    const beat = safeElapsed / BEAT_MS
    const scene = SCENES.find(item => beat >= item.start && beat < item.end) || SCENES[SCENES.length - 1]

    scene.render(this.renderer, beat)
    this.renderer.present(safeElapsed / 1000, scene.grain)
    this.stage.classList.add('is-ready')
  }
}

function waitForFonts () {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve()
  return Promise.race([
    document.fonts.ready,
    new Promise(resolve => window.setTimeout(resolve, 1600))
  ]).catch(() => {})
}

waitForFonts().then(() => {
  try {
    const sequence = new MotionSequence()
    sequence.start()
  } catch (error) {
    console.error('Animation could not start.', error)
  }
})
