import { inject, onBeforeUnmount, provide, ref, watch } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import {
  getAgentStorageScope,
  waitForAgentSession,
  watchAgentIdentity,
} from '@/utils/agent-session';
import { createReadScope } from '../../../utils/agent-read-scope.mjs';

const READ_ACTIVITY = Symbol('agent-read-activity');
export function provideReadActivity(active) {
  const parentActive = inject(READ_ACTIVITY, () => true);
  provide(READ_ACTIVITY, () => parentActive() && active());
}

// Page and retained Sheet lifetimes share the same publication gate.
export function useViewReads(active = () => true, context = () => '') {
  const visible = ref(true);
  const parentActive = inject(READ_ACTIVITY, () => true);
  const isActive = () => parentActive() && active();
  const scope = createReadScope({
    identity: getAgentStorageScope,
    active: () => visible.value && isActive(),
    ready: waitForAgentSession,
    context,
  });
  watchAgentIdentity(scope.identityChanged);
  watch([isActive, () => JSON.stringify(context())], () => scope.invalidate(), { flush: 'sync' });
  onHide(() => {
    visible.value = false;
    scope.invalidate();
  });
  onShow(() => {
    visible.value = true;
  });
  onBeforeUnmount(scope.dispose);
  return scope;
}
