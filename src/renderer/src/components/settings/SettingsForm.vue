<template>
  <div class="settings-form">
    <slot />
  </div>
</template>

<style>
.settings-form {
  --settings-form-max-width: 640px;
  --settings-field-label-width: 128px;

  box-sizing: border-box;
  width: 100%;
  max-width: var(--settings-form-max-width);
  container-name: settings-form;
  container-type: inline-size;
}
</style>
