<template>
  <SettingsField :label="$t('engine.captionEngine')">
    <a-select :value="modelValue" @change="selectEngine">
      <a-select-option
        v-for="option in builtinOptions"
        :key="String(option.value)"
        :value="option.value"
      >
        {{ $t(option.labelKey) }}
      </a-select-option>
      <a-select-option
        v-for="engine in customEngines"
        :key="engine.id"
        :value="engine.id"
        :label="engine.name"
      >
        <span class="custom-option">
          <span>{{ engine.name }}</span>
          <a-popconfirm
            :title="$t('engine.custom.deleteConfirm', { name: engine.name })"
            :ok-text="$t('engine.custom.delete')"
            :cancel-text="$t('engine.cancelChange')"
            @confirm="deleteEngine(engine.id)"
          >
            <DeleteOutlined class="delete-engine" @mousedown.stop @click.stop />
          </a-popconfirm>
        </span>
      </a-select-option>
      <a-select-option :value="ADD_CUSTOM_ENGINE">
        <PlusOutlined /> {{ $t('engine.custom.add') }}
      </a-select-option>
    </a-select>
  </SettingsField>
</template>

<script setup lang="ts">
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { CustomEngineConfig } from '../../../../shared/config/schema.ts'
import type { EngineFieldOption } from '@renderer/engines/types.ts'
import SettingsField from '@renderer/components/settings/SettingsField.vue'

const ADD_CUSTOM_ENGINE = '__add_custom_engine__'

defineProps<{
  modelValue: string
  builtinOptions: readonly EngineFieldOption[]
  customEngines: readonly CustomEngineConfig[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  delete: [id: string]
}>()

function selectEngine(value: string): void {
  if (value === ADD_CUSTOM_ENGINE) emit('add')
  else emit('update:modelValue', value)
}

function deleteEngine(id: string): void {
  emit('delete', id)
}
</script>

<style scoped>
.custom-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.delete-engine {
  color: #ff4d4f;
}
</style>
