// 会话菜单：页面导航头（AgentHeader）与公司浮层面板头共用同一套动作与文案。
// 动作以事件名回抛，由调用方决定后续行为（页面发 emit，面板走组件内部方法）。
export function openAgentMenu(
  {
    workbench = false,
    workbenchBusy = false,
    disabled = false,
    tasksEnabled = false,
    inboxEnabled = false,
    inboxUnreadCount = 0,
  } = {},
  onEvent = () => {}
) {
  const actions = [];
  if (workbench)
    actions.push({ label: workbenchBusy ? '正在打开工作台…' : '前往工作台', event: 'workbench' });
  if (!disabled) actions.push({ label: '清除当前会话', event: 'clear' });
  if (tasksEnabled) actions.push({ label: '任务管理', event: 'open-tasks' });
  if (inboxEnabled)
    actions.push({
      label: inboxUnreadCount ? `通知中心（${inboxUnreadCount} 条未读）` : '通知中心',
      event: 'open-inbox',
    });
  const itemList = actions.map((action) => action.label);
  if (!itemList.length) {
    uni.showToast({ title: '暂无可清除的会话', icon: 'none' });
    return;
  }
  uni.showActionSheet({ itemList, success: ({ tapIndex }) => onEvent(actions[tapIndex]?.event) });
}
