<template>
 <view class="task-notice" role="status"><text>{{ summary }}</text><button @tap="$emit('details', { title: summary, reason: message })">查看原因 ›</button></view>
</template>
<script setup>
defineProps({ message: String, summary: { type: String, default: '暂时没加载出来' } })
defineEmits(['details'])
</script>
<style scoped lang="scss">
@import "../../styles/tokens";
view,text,input { font-size:inherit; line-height:inherit; }
.task-notice { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 12px; padding:8px 0; color:var(--agent-text-muted); font-size:$agent-font-size-compact; }
button { min-height:44px; margin:0; padding:0 4px; background:transparent; color:var(--agent-text-muted); font-size:$agent-font-size-compact; }
button::after { border:0; }
</style>
