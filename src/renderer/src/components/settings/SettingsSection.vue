<template>
  <section class="settings-section">
    <header class="settings-section__header">
      <span class="settings-section__title">{{ title }}</span>
      <span v-if="$slots.extra" class="settings-section__extra">
        <slot name="extra" />
      </span>
    </header>
    <div class="settings-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<style>
.settings-section {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin-top: 12px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--tag-color);
}

.settings-section__header {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--tag-color);
}

.settings-section__title {
  min-width: 0;
  font-weight: 600;
}

.settings-section__extra {
  min-width: 0;
  margin-inline-start: auto;
}

.settings-section__body {
  min-width: 0;
}
</style>
