export default class LayerPageTransition {
  constructor (params) {
    this.layers = []
    this.params = params
  }

  playIn () {
    return new Promise((resolve) => {
      this.createLayers()
      this.animateLayersIn().then(() => {
        resolve()
      })
    })
  }

  playOut () {
    return new Promise((resolve) => {
      this.animateLayersOut().then(() => {
        this.destroyLayers()
        resolve()
      })
    })
  }

  createLayers () {
    this.params.layers.forEach((layer, index) => {
      const l = document.createElement('div')
      l.innerHTML = '<div></div>'

      const el = l.querySelector('div')
      el.style.position = 'absolute'
      el.style.top = '0'
      el.style.display = 'block'
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.zIndex = '1000'
      el.style.backgroundColor = layer.color
      el.style.transform = 'translate3d(-100%, 0, 0)'

      this.innerEl = document.createElement('div')
      this.innerEl.innerHTML = (index == this.params.layers.length - 1) ? this.params.customHTML.html : ''

      this.innerEl.style.opacity = this.params.customHTML.fadeIn ? 0 : 1

      el.appendChild(this.innerEl)

      document.querySelector('body').appendChild(el)
      this.layers.push(el)
    })
  }

  destroyLayers () {
    this.layers.forEach((layer) => {
      layer.parentNode.removeChild(layer)
    })
  }

  animateLayersIn () {
    return new Promise((resolve) => {
      anime({
        targets: this.layers,
        translateX: '100%',
        delay: anime.stagger(this.params.staggerDelay),
        duration: this.params.duration,
        easing: 'easeOutQuad'
      }).finished.then(() => {
        anime({
          targets: this.innerEl,
          opacity: [this.params.customHTML.fadeIn ? 0 : 1, 1],
          duration: this.params.customHTML.fadeIn ? 1000 : 0,
          easing: 'easeOutQuad'
        }).finished.then(() => {
          resolve()
        })
      })
    })
  }

  animateLayersOut () {
    return new Promise((resolve) => {
      anime({
        targets: this.innerEl,
        opacity: [1, this.params.customHTML.fadeIn ? 0 : 1],
        duration: this.params.customHTML.fadeIn ? 1000 : 0,
        easing: 'easeOutQuad'
      }).finished.then(() => {
        anime({
          targets: this.layers,
          translateX: '200%',
          delay: anime.stagger(this.params.staggerDelay, { direction: 'reverse' }),
          duration: this.params.duration,
          easing: 'easeOutQuad'
        }).finished.then(function () {
          resolve()
        })
      })
    })
  }
}
