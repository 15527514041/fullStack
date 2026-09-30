<script setup lang="ts">
// 品牌 logo:public/confluo-logo.svg
// 由 confluo-logo.png 矢量化得到(按颜色分层描摹成平滑贝塞尔路径,
// 渐变端点取自原图内部像素统计),viewBox 已按图形边界收紧
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <img class="logo-img" src="/confluo-logo.svg" alt="Confluo" :width="size" :height="size" />
</template>

<style scoped>
.logo-img {
  display: block;
  flex-shrink: 0;
  object-fit: contain;
  user-select: none;
}
</style>
