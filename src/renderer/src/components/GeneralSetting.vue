<template>
  <a-card size="small" :title="$t('general.title')">
    <template #extra>
      <a-popover>
        <template #content>
          <p class="general-note">{{ $t('general.note') }}</p>
        </template>
        <a><InfoCircleOutlined /></a>
      </a-popover>
    </template>

    <div>
      <div class="input-item">
        <span class="input-label">{{ $t('general.uiLanguage') }}</span>
        <a-radio-group v-model:value="uiLanguage" class="responsive-radio-group">
          <a-radio-button value="zh">中文</a-radio-button>
          <a-radio-button value="en">English</a-radio-button>
          <a-radio-button value="ja">日本語</a-radio-button>
        </a-radio-group>
      </div>

      <div class="input-item">
        <span class="input-label">{{ $t('general.theme') }}</span>
        <a-radio-group v-model:value="uiTheme" class="responsive-radio-group">
          <a-radio-button value="system">{{ $t('general.system') }}</a-radio-button>
          <a-radio-button value="light">{{ $t('general.light') }}</a-radio-button>
          <a-radio-button value="dark">{{ $t('general.dark') }}</a-radio-button>
        </a-radio-group>
      </div>

      <div class="input-item">
        <span class="input-label">{{ $t('general.color') }}</span>
        <a-radio-group v-model:value="uiColor" class="responsive-radio-group color-radio-group">
          <template v-for="color in colorList" :key="color">
            <a-radio-button :value="color"
              :style="{backgroundColor: color}"
            >
              <CheckOutlined style="color: white;" v-if="color === uiColor" />
              <span v-else>&nbsp;</span>
            </a-radio-button>
          </template>
        </a-radio-group>
      </div>

      <div class="input-item">
        <span class="input-label">{{ $t('general.barWidth') }}</span>
        <a-slider class="span-input"
          :min="6" :max="12" v-model:value="leftBarWidth"
          @afterChange="generalSettingStore.sendApplicationConfig"
        />
        <div class="input-item-value">{{ (leftBarWidth * 100 / 24).toFixed(0) }}%</div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useGeneralSettingStore } from '@renderer/stores/generalSetting'
import { InfoCircleOutlined, CheckOutlined } from '@ant-design/icons-vue'

const generalSettingStore = useGeneralSettingStore()
const { uiLanguage, realTheme, uiTheme, uiColor, leftBarWidth } = storeToRefs(generalSettingStore)

const colorListLight = [
  '#1677ff',
  '#00b96b',
  '#fa8c16',
  '#9254de',
  '#eb2f96',
  '#000000'
]

const colorListDark = [
  '#1677ff',
  '#00b96b',
  '#fa8c16',
  '#9254de',
  '#eb2f96',
  '#b9d7ea'
]

const colorList = ref(colorListLight)

watch(realTheme, (val) => {
  if(val === 'dark') {
    colorList.value = colorListDark
  } else {
    colorList.value = colorListLight
  }
})
</script>

<style scoped>
@import url(../assets/input.css);

.span-input {
  grid-column: 2;
  width: 100%;
  min-width: 0;
  margin: 0;
}

.color-radio-group > :deep(.ant-radio-button-wrapper) {
  padding-inline: 0;
}

@container (max-width: 480px) {
  .span-input {
    grid-column: 1;
  }
}

.general-note {
  padding: 10px 10px 0;
  max-width: min(36vw, 400px);
}
</style>
