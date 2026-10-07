<template>
 <!-- 空容器只承接微信返回，遮罩与位移仍由原组件绘制。 -->
 <!-- #ifdef MP-WEIXIN -->
 <page-container v-if="active && visible && armed" :show="true" :duration="0" :overlay="false" @afterleave="leave" />
 <!-- #endif -->
</template>
<script setup>
import { nextTick, ref } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
const props = defineProps({ active: Boolean, back: Function })
const visible = ref(true), armed = ref(true)
onHide(() => { visible.value = false })
onShow(() => { visible.value = true })
async function leave() {
 if (!props.active || !visible.value) return
 armed.value = false
 try { await props.back?.() }
 finally { await nextTick(); armed.value = true }
}
</script>
