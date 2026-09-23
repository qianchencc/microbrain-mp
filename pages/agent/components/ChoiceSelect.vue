<template><view class="choice"><button class="trigger" :disabled="disabled" :aria-expanded="open" @tap="open = !open"><text>{{ options[modelValue] }}</text><uni-icons :type="open ? 'up' : 'down'" size="13" color="#728178" /></button><view v-if="open" class="dismiss" @tap="open = false" /><uni-transition :show="open" :mode-class="['fade','slide-top']" :duration="160" :styles="{position:'absolute',top:'46px',left:'0',minWidth:'176px',zIndex:32}"><view class="menu"><button v-for="(option,index) in options" :key="option" :class="{active:index === modelValue}" @tap="select(index)"><text>{{ option }}</text><uni-icons v-if="index === modelValue" type="checkmarkempty" size="15" color="#176b54" /></button></view></uni-transition></view></template>
<script setup>
import { ref } from 'vue'
defineProps({modelValue:Number,options:Array,disabled:Boolean})
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
function select(index) { emit('update:modelValue',index); open.value = false }
</script>
<style scoped>
.choice { position:relative; }.trigger { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 12px; margin:0; min-height:42px; line-height:42px; border:1px solid #d5dfd8; border-radius:6px; background:#fcfdfc; font-size:13px; color:#304c3e; }.dismiss { position:fixed; inset:0; z-index:31; }.menu { padding:4px; border:1px solid #dae3dc; border-radius:8px; background:#fff; box-shadow:0 6px 24px #183b2426; }.menu button { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0; padding:0 10px; line-height:44px; min-height:44px; border-radius:4px; background:white; color:#536b5b; font-size:13px; text-align:left; }.menu button.active { background:#edf4ef; color:#176b54; }button::after { border:0; }
</style>
