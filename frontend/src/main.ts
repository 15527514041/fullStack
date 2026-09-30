import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/theme.css'

import i18n from './lang'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
// i18n 要在 router 之前:首个路由的标题同步就会用到
app.use(i18n)
app.use(router)
// Element Plus 的语言由 App.vue 的 el-config-provider 动态提供
app.use(ElementPlus)

app.mount('#app')
