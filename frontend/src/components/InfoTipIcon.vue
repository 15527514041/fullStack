<script setup lang="ts">
withDefaults(defineProps<{
  content: string
  size?: number
}>(), {
  size: 18
})

const infoTipPath =
  'M16.4004 10C16.4004 6.46538 13.5346 3.59961 10 3.59961C6.46538 3.59961 3.59961 6.46538 3.59961 10C3.59961 13.5346 6.46538 16.4004 10 16.4004V18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18V16.4004C13.5346 16.4004 16.4004 13.5346 16.4004 10ZM10.0078 12.4004C10.4496 12.4004 10.8076 12.7584 10.8076 13.2002C10.8075 13.6419 10.4496 14 10.0078 14H10C9.55824 14 9.2003 13.6419 9.2002 13.2002C9.2002 12.7584 9.55817 12.4004 10 12.4004H10.0078ZM9.2002 10V6.7998C9.2003 6.35807 9.55824 6 10 6C10.4418 6 10.7997 6.35807 10.7998 6.7998V10C10.7998 10.4418 10.4418 10.7998 10 10.7998C9.55817 10.7998 9.2002 10.4418 9.2002 10Z'
</script>

<template>
  <el-tooltip :content="content" placement="top">
    <span class="info-tip" tabindex="0" :aria-label="content">
      <svg
        class="info-tip__icon"
        :width="size"
        :height="size"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path :d="infoTipPath" fill="currentColor" />
      </svg>
    </span>
  </el-tooltip>
</template>

<style scoped>
.info-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  outline: none;
  color: var(--color-text-3);
  cursor: help;
}

.info-tip__icon {
  display: block;
  flex-shrink: 0;
}

.info-tip:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: 50%;
}
</style>
