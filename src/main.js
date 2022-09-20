import Vue from 'vue'
import App from './App.vue'

Vue.config.productionTip = false

import './assets/scss/index.scss' // global css
import './assets/iconfont/iconfont.css'
new Vue({
  render: h => h(App)
}).$mount('#app')
