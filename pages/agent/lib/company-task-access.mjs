import { ref, watch } from 'vue';
import { getCompanyTaskAccess } from '@/apis/agent/tasks';
import { watchAgentIdentity } from '@/utils/agent-session';
import { useViewReads } from './reads.mjs';

// 页面进入时读取一次；不轮询。仪表盘把同一结果传给公司浮层。
export function useCompanyTaskAccess(active) {
  const enabled = ref(false);
  const reads = useViewReads(active);
  const refresh = () =>
    reads.run('company-task-access', getCompanyTaskAccess, {
      data: (result) => {
        enabled.value = result.enabled === true;
      },
      error: () => {
        enabled.value = false;
      },
      denied: () => {
        enabled.value = false;
      },
    });
  watch(
    active,
    (value) => {
      if (value) void refresh();
    },
    { immediate: true }
  );
  watchAgentIdentity(() => {
    enabled.value = false;
    if (active()) void refresh();
  });
  return enabled;
}
