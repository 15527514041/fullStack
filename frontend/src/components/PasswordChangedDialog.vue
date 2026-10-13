<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MenuIcon from '@/components/MenuIcon.vue'
import { useAuthStore } from '@/stores/auth'

/**
 * 密码修改成功提示(参考 client 修改密码的第三步)
 * 密码已经变了,旧登录态必须作废:倒计时 5 秒自动回登录页,也可以点按钮立刻走
 */
const REDIRECT_SECONDS = 5

const props = withDefaults(defineProps<{ visible: boolean }>(), { visible: false })
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const router = useRouter()
const authStore = useAuthStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const seconds = ref(REDIRECT_SECONDS)
let timer: ReturnType<typeof setInterval> | null = null
let redirecting = false

function clearTimer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function startCountdown(): void {
  clearTimer()
  seconds.value = REDIRECT_SECONDS
  timer = setInterval(() => {
    seconds.value -= 1
    if (seconds.value <= 0) {
      handleRelogin()
    }
  }, 1000)
}

// 重新登录:清掉本地登录态再回登录页,顺手停掉倒计时
function handleRelogin(): void {
  if (redirecting) return
  redirecting = true
  clearTimer()
  dialogVisible.value = false
  authStore.logout()
  router.replace('/login')
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      startCountdown()
    } else {
      clearTimer()
      redirecting = false
    }
  }
)

onUnmounted(clearTimer)
</script>

<template>
  <!-- result-dialog:没有标题,靠全局样式去掉那条空的分隔线 -->
  <el-dialog
    v-model="dialogVisible"
    class="result-dialog"
    width="min(420px, 92vw)"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
  >
    <div class="success-panel">
      <MenuIcon name="success" :size="48" class="success-icon" />
      <h3 class="success-title">{{ $t('password.successTitle') }}</h3>
      <p class="success-tip">{{ $t('password.successTip') }}</p>
      <p class="success-redirect">{{ $t('password.redirectTip', { seconds }) }}</p>
    </div>

    <template #footer>
      <el-button type="primary" class="relogin-btn" @click="handleRelogin">{{ $t('password.relogin') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.success-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 0;
  text-align: center;
}

.success-icon {
  color: var(--color-success-6);
}

.success-title {
  margin: 30px 0 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  color: var(--color-text-1);
}

.success-tip {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-3);
}

.success-redirect {
  margin: 20px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--color-brand-6);
}

.relogin-btn {
  width: 100%;
}
</style>
