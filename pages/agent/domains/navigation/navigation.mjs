// 页面归属决定无栈兜底；正常返回保持真实历史。
const dashboard = '/pages/agent/dashboard';
export function previousPageLabel(pages, fallback = '总览') {
  const page = pages.at(-2);
  if (!page) return fallback;
  if (page.route === 'pages/agent/index')
    return page.options?.source === 'company' ? '公司 Agent' : '办公室 Agent';
  return page.route === 'pages/agent/region'
    ? '区域工作台'
    : page.route === 'pages/agent/dashboard'
      ? '总览'
      : '服务首页';
}
export function backToParent(parent = dashboard) {
  uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: parent }) });
}
export function returnToOfficeConversation() {
  const pages = getCurrentPages();
  let target = -1;
  for (let index = pages.length - 2; index >= 0; index--) {
    if (pages[index].route === 'pages/agent/index' && pages[index].options?.source !== 'company') {
      target = index;
      break;
    }
  }
  if (target >= 0) uni.navigateBack({ delta: pages.length - 1 - target });
  else uni.redirectTo({ url: '/pages/agent/index?source=office' });
}
