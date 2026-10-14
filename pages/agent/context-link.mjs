// Agent 深链上下文解析：office 页面 onLoad 与仪表盘公司浮层共用。
// URL 参数 → { reference, prompt }；非法参数只提示不中断。面板/页内直开时
// 不再过 URL，直接用 environmentHistoryPrompt / meterHistoryPrompt 造提示词。
import { safetyEventReference } from './safety-event.mjs'

function parseJson(raw, invalidTitle) {
 try { return JSON.parse(decodeURIComponent(raw)) }
 catch { uni.showToast({ title: invalidTitle, icon: 'none' }); return undefined }
}

function validWindow(window) {
 return window && typeof window.from === 'string' && typeof window.to === 'string'
  && window.from.length <= 40 && window.to.length <= 40
  && Number.isFinite(Date.parse(window.from)) && Number.isFinite(Date.parse(window.to))
}

export function environmentHistoryPrompt(window) {
 if (!validWindow(window)) return ''
 return `请查询并解释站点环境历史，期间 ${window.from} 至 ${window.to}。哪些指标变化明显？`
}

export function meterHistoryPrompt(window) {
 if (!validWindow(window) || typeof window.meter?.name !== 'string' || window.meter.name.length > 60 || typeof window.meter.id !== 'string' || window.meter.id.length > 60) return ''
 return `查询电表“${window.meter.name.slice(0, 30)}”（${window.meter.id}）：${window.from}至${window.to}，仅原始累计示数。`
}

// company=false 时只取任务引用（office 直达链不会带公司参数）。
export function parseAgentContext(options = {}, { company = true } = {}) {
 const context = { reference: null, prompt: '' }
 if (options.taskReference) {
  const ref = parseJson(options.taskReference, '任务引用无效')
  if ((ref?.type === 'task' && typeof ref.taskId === 'string') || (ref?.type === 'task_plan' && typeof ref.planId === 'string')) context.reference = ref
 }
 if (!company) return context
 if (options.safetyReference !== undefined) {
  const value = parseJson(options.safetyReference, '安全台账引用无效')
  if (value !== undefined) {
   const ref = safetyEventReference(value)
   if (ref) context.reference = { ...ref, ...(typeof value.label === 'string' ? { label: value.label.slice(0, 300) } : {}) }
   else uni.showToast({ title: '安全台账引用无效', icon: 'none' })
  }
 }
 if (options.environmentWindow) {
  const prompt = environmentHistoryPrompt(parseJson(options.environmentWindow, '环境期间无效'))
  if (prompt) context.prompt = prompt
 }
 if (options.energyWindow) {
  const prompt = meterHistoryPrompt(parseJson(options.energyWindow, '计量点期间无效'))
  if (prompt) context.prompt = prompt
 }
 if (options.alertPrompt !== undefined) {
  let content = ''
  try { content = decodeURIComponent(options.alertPrompt).trim() } catch { /* malformed customer quote */ }
  if (content && content.length <= 2000) context.reference = { type: 'customer_alert', content }
  else uni.showToast({ title: '告警引用无效或超过2000字', icon: 'none' })
 }
 return context
}
