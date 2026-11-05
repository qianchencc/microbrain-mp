// 环境历史期间的结构化引用：只固定服务端已验证的起止时间，不携带客户端样本。
// 发送时 Runtime 按当前 Company 授权重读同一窗口；引用不授予设备操作权限。
import { fmtShanghaiDateTime } from './observation-view.mjs';

function zonedTime(value) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

function validWindow(window) {
  return (
    window &&
    typeof window.from === 'string' &&
    typeof window.to === 'string' &&
    window.from.length <= 40 &&
    window.to.length <= 40 &&
    zonedTime(window.from) &&
    zonedTime(window.to) &&
    Date.parse(window.from) <= Date.parse(window.to)
  );
}

export function environmentHistoryPrompt(window) {
  if (!validWindow(window)) return '';
  return `请查询并解释站点环境历史，期间 ${window.from} 至 ${window.to}。哪些指标变化明显？`;
}

export function environmentWindowLabel(window) {
  if (!validWindow(window)) return '';
  const from = fmtShanghaiDateTime(window.from),
    to = fmtShanghaiDateTime(window.to);
  return from && to ? `${from} 至 ${to}` : '';
}

export function environmentWindowReference(window) {
  if (!validWindow(window)) return null;
  const label = environmentWindowLabel(window);
  return {
    type: 'environment_window',
    from: window.from,
    to: window.to,
    ...(label ? { label } : {}),
  };
}
