<script setup lang="ts">
// 品牌 logo:public/confluo-logo.png
// 已把原图(1204×1204、四周大留白)裁掉留白并压成 256×256,图形在画布中居中
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <img class="logo-img" src="/confluo-logo.png" alt="Confluo" :width="size" :height="size" />
</template>

<style scoped>
.logo-img {
  display: block;
  flex-shrink: 0;
  object-fit: contain;
  user-select: none;
}
</style>
