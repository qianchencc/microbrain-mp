<template><rich-text class="answer" :nodes="rendered" :selectable="true" /></template>
<script setup>
import { computed } from 'vue'
import { renderAnswer } from '../../domains/conversation/answer.mjs'
const props = defineProps({content:String})
const rendered = computed(() => renderAnswer(props.content))
</script>
<style scoped>.answer { display:block; margin-top:10px; font-size:15px; line-height:1.8; overflow-wrap:anywhere; overflow-x:auto; scrollbar-width:none; }.answer::-webkit-scrollbar { display:none; width:0; height:0; }</style>
