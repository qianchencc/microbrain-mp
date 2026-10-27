// 观察面共用呈现助手（ObservationCard / 区域抽屉观察 pane）：只格式化 runtime 给出的原始事实，不编造取值。

import { modeLabels } from './ac-draft.js'

const OBSERVE_STALE_MS = 24 * 3600 * 1000

const SAFETY_SUBTYPES = { smoke: '烟感', water: '水浸', gas: '燃气' }
const ENV_KEYS = [
 ['temp', '温度', '°C'],
 ['humidity', '湿度', '%'],
 ['pm25', 'PM2.5', ''],
 ['pm101', 'PM10', ''],
 ['pm10', 'PM1.0', ''],
]

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null

export function fmtDateTime(iso) {
 const time = Date.parse(iso || '')
 if (!Number.isFinite(time)) return ''
 const d = new Date(time)
 const pad = n => String(n).padStart(2, '0')
 return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtShanghaiDateTime(iso) {
 const time = Date.parse(iso || '')
 if (!Number.isFinite(time)) return ''
 return new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
}

export function ageHint(iso, nowMs = Date.now()) {
 const time = Date.parse(iso || '')
 if (!Number.isFinite(time)) return ''
 const age = Math.max(0, nowMs - time)
 if (age < 60 * 1000) return '1 分钟内'
 if (age < 3600 * 1000) return `${Math.floor(age / 60000)} 分钟前`
 if (age < 24 * 3600 * 1000) return `${Math.floor(age / 3600000)} 小时前`
 if (age < 30 * 24 * 3600 * 1000) return `${Math.floor(age / 86400000)} 天前`
 return `${Math.floor(age / (30 * 86400000))} 个月前`
}

export const videoOnline = value => (value === true ? true : value === false ? false : null)
export const videoStateText = online => online === true ? '在线' : online === false ? '离线' : '状态未知'

// 视频「查看画面」按钮文案：区分播放页未部署 / 取流中 / 可播 / 离线 / 未知。
export function videoViewLabel(online, playerReady, fetching) {
 if (fetching) return '正在取流…'
 if (!playerReady) return '播放页接入中'
 return online === true ? '查看画面' : online === false ? '已离线' : '状态未知'
}

export function environmentCells(reading) {
 if (!reading || typeof reading !== 'object') return []
 return ENV_KEYS.flatMap(([key, label, unit]) => {
  const value = finite(reading[key])
  return value === null ? [] : [{ key, label, value: `${value}${unit}` }]
 })
}

export const environmentSource = reading =>
 reading?.source === 'shadow' ? '平台影子值' : reading?.source === 'device' ? '设备实时读' : ''

export function energyPowerText(reading) {
 const power = finite(reading?.totalActivePower)
 return power !== null ? `${power} kW` : reading ? '读数不全' : '暂无读数'
}

export function energyCurrentCells(reading) {
 return ['ia', 'ib', 'ic'].flatMap((key, index) => {
  const value = finite(reading?.[key])
  return value === null ? [] : [{ key: `I${'abc'[index]}`, value: `${value} A` }]
 })
}

// 能耗读数允许陈旧：readTime 缺失或超过一天即标陈旧（标注不是拒绝）。
export function energyStale(reading, nowMs = Date.now()) {
 const time = Date.parse(reading?.readTime || '')
 return !Number.isFinite(time) || nowMs - time > OBSERVE_STALE_MS
}

// 与 runtime domain.safetySubtypeOf 同一判定：烟 / 水浸 / 燃气。
export function safetySubtypeOfName(name) {
 const text = String(name || '')
 if (/烟/.test(text)) return 'smoke'
 if (/水浸/.test(text)) return 'water'
 if (/燃气/.test(text)) return 'gas'
 return ''
}

export const safetySubtypeText = subtype => SAFETY_SUBTYPES[subtype] || '安全'

// 空调巡检/调温行：指令与回读是不同事实。adjusted 只承诺「已下发调温指令」，
// 调后温度只写平台权威快照的回读值（afterSetpoint），不从指令目标反推设备已达目标值；
// 平台读数可能与现场面板（半度设定、事后手动改回）不一致，如实标注为平台回读。
const AC_DISPOSITIONS = { adjustable: '可调', not_needed: '无需调整', unknown: '结果待确认', not_dispatched: '这次未调整' }
const acAdjustedText = target => Number.isFinite(target) ? `已下发调到${target}℃` : '已下发调温指令'
export const acDispositionText = (device, target) => (device.disposition === 'adjusted' ? acAdjustedText(target) : AC_DISPOSITIONS[device.disposition]) || '状态未知'
export const acReadbackText = device => finite(device?.afterSetpoint) !== null ? `平台回读 ${device.afterSetpoint}℃` : ''
export const acStateText = device => [device.power === 'on' ? '开机' : device.power === 'off' ? '关机' : '电源未知', modeLabels[device.mode] || device.mode || '模式未知', Number.isFinite(device.setpoint) ? `${device.setpoint}℃` : '设定未知'].join(' · ')
export const acDotOf = device => device.disposition === 'adjustable' ? 'on' : device.disposition === 'not_needed' ? 'off' : 'warn'
export function acInspectionMeta(device, block) {
 const readback = acReadbackText(device)
 const target = block?.criteria?.setpoint?.value
 return `${acDispositionText(device, target)} · ${block?.mode === 'adjust_to_26' ? '检查前：' : ''}${acStateText(device)}${readback ? ` · ${readback}` : ''}`
}
