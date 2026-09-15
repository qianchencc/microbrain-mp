<template><view class="avatar" :class="{ running }"><image :src="layers.body" class="body" /><image :src="layers.eyes" class="eyes" :style="{ transform: `translate(${x}px,${y}px)` }" /></view></template>
<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { avatarLayers } from '../avatar.js'
const props = defineProps({running:Boolean})
const layers = computed(() => avatarLayers())
const x = ref(0), y = ref(0)
let timer
onMounted(() => { timer = setInterval(() => { x.value = Math.random()*2.4-1.2; y.value = Math.random()*1.6-.8 }, 2900) })
onBeforeUnmount(() => clearInterval(timer))
</script>
<style scoped>
.avatar { position:relative; width:36px; height:36px; border-radius:9px; background:white; box-shadow:0 0 0 1px #19372b1f; overflow:hidden; flex-shrink:0; }.body,.eyes { position:absolute; width:36px; height:36px; left:0; top:0; }.eyes { transition:transform 500ms cubic-bezier(.23,1,.32,1); }.running .body { animation:breathe 2.4s ease-in-out infinite; }@keyframes breathe { 50% { transform:scale(1.035); } }@media(prefers-reduced-motion:reduce) { .eyes { transform:none!important; transition:none; }.body {animation:none!important;} }
</style>
