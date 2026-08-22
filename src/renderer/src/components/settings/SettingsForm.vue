<template>
  <div class="settings-form">
    <div class="settings-form__content">
      <slot />
    </div>
  </div>
</template>

<style>
.settings-form {
  --settings-form-max-width: 640px;
  --settings-form-safe-inline: 16px;
  --settings-field-label-width: 96px;
  --settings-field-column-gap: 12px;
  --settings-field-control-min-width: 220px;

  box-sizing: border-box;
  width: 100%;
  max-width: var(--settings-form-max-width);
  container-name: settings-form;
  container-type: inline-size;
}

.settings-form__content {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding-inline: var(--settings-form-safe-inline);
}
</style>
