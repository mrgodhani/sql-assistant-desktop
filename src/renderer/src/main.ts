import './assets/styles/globals.css'
import 'prismjs/themes/prism-tomorrow.css'

import log from 'electron-log/renderer'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  log.error(`[Renderer] Error in ${info}:`, err)
}

window.addEventListener('unhandledrejection', (event) => {
  log.error('[Renderer] Unhandled Promise Rejection:', event.reason)
})

app.use(createPinia())
app.use(router)
app.mount('#app')
