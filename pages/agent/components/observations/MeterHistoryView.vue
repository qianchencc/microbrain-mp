<template>
 <CompanyEnergySheet class="history" :active="active" bounded :initial-query="initialQuery" />
</template>
<script setup>
import CompanyEnergySheet from '../energy/CompanyEnergySheet.vue'
defineProps({ active: Boolean, initialQuery: Object, showQuestion: { type: Boolean, default: true } })
defineEmits(['question'])
</script>
<style scoped>
view, text, input { font-size:inherit;line-height:inherit; }
.history { flex:1;min-height:0;height:0;display:flex;flex-direction:column; }
</style>
