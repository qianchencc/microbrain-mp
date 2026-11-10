<template>
  <!-- 空容器只承接微信返回，遮罩与位移仍由原组件绘制。 -->
  <!-- #ifdef MP-WEIXIN -->
  <page-container
    v-if="active && visible && armed"
    :show="!releasing"
    :duration="0"
    :overlay="false"
    @afterleave="leave"
  />
  <!-- #endif -->
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
const props = defineProps({ active: Boolean, back: Function });
const visible = ref(true),
  armed = ref(true);
const releasing = ref(false);
let releaseDone, releasePromise;
function finishRelease() {
  releaseDone?.();
  releaseDone = undefined;
  releasePromise = undefined;
}
function prepareNavigation() {
  if (!props.active || !visible.value || !armed.value) return Promise.resolve();
  // #ifdef MP-WEIXIN
  if (releasePromise) return releasePromise;
  releasePromise = new Promise((resolve) => {
    releaseDone = resolve;
  });
  releasing.value = true;
  return releasePromise;
  // #endif
  // #ifndef MP-WEIXIN
  return Promise.resolve();
  // #endif
}
watch(
  () => props.active,
  (active) => {
    if (active) releasing.value = false;
    else finishRelease();
  }
);
onBeforeUnmount(finishRelease);
defineExpose({ prepareNavigation });
onHide(() => {
  visible.value = false;
  finishRelease();
});
onShow(() => {
  visible.value = true;
});
async function leave() {
  if (releasing.value) {
    finishRelease();
    return;
  }
  if (!props.active || !visible.value) return;
  armed.value = false;
  try {
    await props.back?.();
  } finally {
    await nextTick();
    armed.value = true;
  }
}
</script>
