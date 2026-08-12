<template>
  <div class="input-item">
    <a-popover v-if="field.helpKey" placement="right">
      <template #content>
        <p class="label-hover-info">{{ $t(field.helpKey) }}</p>
        <p v-if="field.helpLink">
          <a :href="field.helpLink" target="_blank">
            {{ field.helpLinkLabelKey ? $t(field.helpLinkLabelKey) : field.helpLink }}
          </a>
        </p>
      </template>
      <span class="input-label info-label" :style="{ color: accentColor }">
        {{ $t(field.labelKey) }}
      </span>
    </a-popover>
    <span v-else class="input-label">{{ $t(field.labelKey) }}</span>

    <span
      v-if="field.control === 'directory'"
      class="input-folder"
      :style="{ color: accentColor }"
      @click="$emit('browse')"
      ><FolderOpenOutlined
    /></span>

    <a-select
      v-if="field.control === 'select'"
      class="input-area"
      :value="modelValue"
      :disabled="field.disabled"
      :options="localizedOptions"
      @update:value="$emit('update:modelValue', $event)"
    />
    <a-input
      v-else-if="field.control === 'text' || field.control === 'directory'"
      class="input-area"
      :class="{ 'input-area-with-folder': field.control === 'directory' }"
      :value="modelValue"
      :placeholder="field.placeholder"
      @update:value="$emit('update:modelValue', $event)"
    />
    <a-input
      v-else-if="field.control === 'password'"
      class="input-area"
      type="password"
      :value="modelValue"
      :placeholder="field.placeholder"
      @update:value="$emit('update:modelValue', $event)"
    />
    <a-input-number
      v-else-if="field.control === 'number'"
      class="input-area"
      :value="modelValue"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :addon-after="field.addonAfterKey ? $t(field.addonAfterKey) : undefined"
      @update:value="$emit('update:modelValue', $event)"
    />
    <a-switch
      v-else-if="field.control === 'switch'"
      :checked="modelValue"
      @update:checked="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpenOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { EngineFieldDescriptor } from '@renderer/engines/types.ts'

const props = defineProps<{
  field: EngineFieldDescriptor
  modelValue: unknown
  accentColor: string
}>()

defineEmits<{
  'update:modelValue': [value: unknown]
  browse: []
}>()

const { t } = useI18n()
const localizedOptions = computed(
  () =>
    props.field.options?.map((option) => ({
      value: option.value,
      label: t(option.labelKey)
    })) ?? []
)
</script>

<style scoped>
@import url(../../assets/input.css);

.label-hover-info {
  margin-top: 10px;
  max-width: min(36vw, 380px);
}

.info-label {
  cursor: pointer;
  font-style: italic;
}

.input-folder {
  flex: 0 0 40px;
  width: 40px;
  font-size: 1.38em;
  cursor: pointer;
  transition: all 0.25s;
}

.input-folder:hover {
  transform: scale(1.1);
}

.input-area-with-folder {
  flex: 1 1 100px;
  width: auto;
  min-width: 0;
}
</style>
