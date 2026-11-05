// Agent 深链上下文解析：office 页面 onLoad 与仪表盘公司浮层共用。
// URL 参数 → { reference, prompt }；非法参数只提示不中断。面板/页内直开时
// 环境历史走 environmentWindowReference，电表仍用 meterHistoryPrompt。
import { safetyEventReference } from '../observations/safety-event.mjs';
import {
  environmentHistoryPrompt,
  environmentWindowReference,
} from '../observations/environment-reference.mjs';

function parseJson(raw, invalidTitle) {
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    uni.showToast({ title: invalidTitle, icon: 'none' });
    return undefined;
  }
}

// 卡片/深链参数可能已被框架解码过一次；再解码失败就按原文使用，不整条丢引用。
function decodeParam(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const ALERT_LEDGERS = ['gas', 'flooding', 'smoke'];
const isAlertLedger = (value) => ALERT_LEDGERS.includes(value);

function param(raw) {
  return raw === undefined || raw === null ? '' : decodeParam(String(raw));
}

function validWindow(window) {
  return (
    window &&
    typeof window.from === 'string' &&
    typeof window.to === 'string' &&
    window.from.length <= 40 &&
    window.to.length <= 40 &&
    Number.isFinite(Date.parse(window.from)) &&
    Number.isFinite(Date.parse(window.to))
  );
}

export function meterHistoryPrompt(window) {
  if (
    !validWindow(window) ||
    typeof window.meter?.name !== 'string' ||
    window.meter.name.length > 60 ||
    typeof window.meter.id !== 'string' ||
    window.meter.id.length > 60
  )
    return '';
  return `查询电表“${window.meter.name.slice(0, 30)}”（${window.meter.id}）：${window.from}至${window.to}，仅原始累计示数。`;
}

// company=false 时只取任务引用（office 直达链不会带公司参数）。
export function parseAgentContext(options = {}, { company = true } = {}) {
  const context = { reference: null, prompt: '' };
  if (options.taskReference) {
    const ref = parseJson(options.taskReference, '任务引用无效');
    if (
      (ref?.type === 'task' && typeof ref.taskId === 'string') ||
      (ref?.type === 'task_plan' && typeof ref.planId === 'string')
    )
      context.reference = ref;
  }
  if (!company) return context;
  if (options.safetyReference !== undefined) {
    const value = parseJson(options.safetyReference, '安全台账引用无效');
    if (value !== undefined) {
      const ref = safetyEventReference(value);
      if (ref)
        context.reference = {
          ...ref,
          ...(typeof value.label === 'string' ? { label: value.label.slice(0, 300) } : {}),
        };
      else uni.showToast({ title: '安全台账引用无效', icon: 'none' });
    }
  }
  if (options.environmentWindow) {
    const value = parseJson(options.environmentWindow, '环境期间无效');
    if (value !== undefined) {
      const reference = environmentWindowReference(value);
      if (reference) {
        context.reference = reference;
        context.prompt = environmentHistoryPrompt(value);
      } else uni.showToast({ title: '环境期间无效', icon: 'none' });
    }
  }
  if (options.energyWindow) {
    const prompt = meterHistoryPrompt(parseJson(options.energyWindow, '计量点期间无效'));
    if (prompt) context.prompt = prompt;
  }
  // 消息卡片三元组：ledger + eventId + deviceId 由发送端按条拼，落地即结构化引用。
  // 缺 eventId 时退化为客户告警文本（设备/时间仍可指导检索），不静默丢引用。
  if (
    options.alertLedger !== undefined ||
    options.alertEventId !== undefined ||
    options.alertDeviceId !== undefined
  ) {
    const ledger = param(options.alertLedger).trim();
    const eventId = param(options.alertEventId).trim();
    const deviceId = param(options.alertDeviceId).trim();
    const label = param(options.alertLabel).trim().slice(0, 300);
    if (ledger && !isAlertLedger(ledger))
      uni.showToast({ title: '告警台账类型无效', icon: 'none' });
    else if (eventId.length > 300 || deviceId.length > 300)
      uni.showToast({ title: '告警标识超过300字', icon: 'none' });
    else if (isAlertLedger(ledger) && eventId && deviceId)
      context.reference = {
        type: 'safety_event',
        ledger,
        eventId,
        deviceId,
        ...(label ? { label } : {}),
      };
    else if (label) {
      context.reference = { type: 'customer_alert', content: label };
      uni.showToast({ title: '缺少告警记录标识，按原文引用', icon: 'none' });
    } else uni.showToast({ title: '告警引用缺少记录标识', icon: 'none' });
  }
  // 预置问题：只填输入框等用户发送，不自动发起对话。
  if (options.prompt !== undefined) {
    const prompt = decodeParam(String(options.prompt)).trim();
    if (prompt && prompt.length <= 200 && !/[\u0000-\u001f]/.test(prompt)) context.prompt = prompt;
    else if (prompt) uni.showToast({ title: '预置问题无效或超过200字', icon: 'none' });
  }
  // 卡片同时带结构化引用与 alertPrompt 时，结构化优先；alertPrompt 只在没有引用的旧路径生效。
  if (options.alertPrompt !== undefined && !context.reference) {
    const content = decodeParam(String(options.alertPrompt)).trim();
    if (content && content.length <= 2000) context.reference = { type: 'customer_alert', content };
    else uni.showToast({ title: '告警引用无效或超过2000字', icon: 'none' });
  }
  return context;
}
