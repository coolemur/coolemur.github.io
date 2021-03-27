import LayerPageTransition from './LayerPageTransition.js'

const lpt = new LayerPageTransition({
  staggerDelay: 100,
  duration: 700,
  layers: [{ color: '#2C3E50' }, { color: '#212F3D' }, { color: '#1B2631' }],
  customHTML: {
    html: `
    <div class="subheading" id="div1">
      Coolemur
    </div>
    <style>
      #div1 {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate3d(-50%, -50%, 0);
        color: white;
        font-size: 30px;
      }
    </style>
    `,
    fadeIn: true
  }
})

lpt.playIn().then(() => {
  setTimeout(() => {
    lpt.playOut().then(() => {
      document.querySelector('.content').style.opacity = '1'
    })
  }, 1000)
})
