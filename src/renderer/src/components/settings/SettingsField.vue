<template>
  <div
    class="settings-field"
    :class="`settings-field--${kind}`"
  >
    <div class="settings-field__label">
      <slot name="label">{{ label }}</slot>
    </div>
    <div class="settings-field__control" :class="`settings-field__control--${controlLayout}`">
      <slot />
    </div>
    <div v-if="$slots.value || $slots.description" class="settings-field__supporting">
      <div v-if="$slots.value" class="settings-field__value">
        <slot name="value" />
      </div>
      <div v-if="$slots.description" class="settings-field__description">
        <slot name="description" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    kind?: 'standard' | 'switch'
    controlLayout?: 'fill' | 'equal' | 'intrinsic'
  }>(),
  {
    label: '',
    kind: 'standard',
    controlLayout: 'fill'
  }
)
</script>

<style>
.settings-field {
  display: grid;
  grid-template-columns:
    var(--settings-field-label-width, 96px)
    minmax(var(--settings-field-control-min-width, 220px), 1fr);
  align-items: start;
  column-gap: var(--settings-field-column-gap, 12px);
  row-gap: 6px;
  margin: 12px 0;
}

.settings-field__label {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  min-width: 0;
  text-align: end;
  overflow-wrap: anywhere;
  white-space: normal;
  line-height: 1.4;
}

.settings-field--switch > .settings-field__label {
  padding-top: 0;
}

.settings-field__control {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  min-width: 0;
}

.settings-field__supporting {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
  display: grid;
  row-gap: 6px;
}

.settings-field__control--fill > * {
  width: 100%;
  min-width: 0;
}

.settings-field__control--fill > .ant-slider {
  width: auto;
}

.settings-field__control--intrinsic {
  justify-self: start;
}

.settings-field__control--equal > .ant-radio-group {
  width: 100%;
  min-width: 0;
  display: grid !important;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
}

.settings-field__control--equal > .ant-radio-group > .ant-radio-button-wrapper {
  min-width: 0;
  padding-inline: 8px;
  text-align: center;
  white-space: nowrap;
}

.settings-field__value {
  box-sizing: border-box;
  width: 100%;
  color: var(--tag-color);
  font-size: 12px;
  text-align: end;
}

.settings-field__description {
  color: var(--tag-color);
  font-size: 12px;
}

@container settings-form (max-width: 359px) {
  .settings-field--standard {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-field--standard > .settings-field__label,
  .settings-field--standard > .settings-field__control,
  .settings-field--standard > .settings-field__supporting {
    grid-column: 1;
  }

  .settings-field--standard > .settings-field__label {
    grid-row: 1;
    padding-top: 0;
    text-align: start;
  }

  .settings-field--standard > .settings-field__control {
    grid-row: 2;
  }

  .settings-field--standard > .settings-field__supporting {
    grid-row: 3;
  }

  .settings-field--switch {
    grid-template-columns: var(--settings-field-label-width, 96px) auto;
    justify-content: start;
  }
}
</style>
