<template><EnergyBusinessReport :report="adapted" :running="running" /></template>
<script setup>
import { computed } from 'vue'
import EnergyBusinessReport from './EnergyBusinessReport.vue'
import { legacyCompanyEnergy } from '../energy-business-view.mjs'
const props = defineProps({ report: { type: Object, required: true }, running: Boolean })
const adapted = computed(() => legacyCompanyEnergy(props.report))
</script>
