import { resolveDeviceArtwork } from '../../device-art/catalog.js'

const kindNames = { lighting: '照明', ac: '空调', access: '门禁', video: '视频', environment: '环境', energy: '能耗', safety: '安全', unknown: '其他' }
const kindOrder = { lighting: 0, ac: 1, access: 2, video: 3, environment: 4, energy: 5, safety: 6, unknown: 7 }
const OBSERVE = 'observe'

/** 只读观察类（视频/环境/能耗/消防）：分组并入“仅观察”，详情走观察 pane。 */
export const OBSERVATION_KINDS = ['video', 'environment', 'energy', 'safety']
export const isObservationKind = kind => OBSERVATION_KINDS.includes(kind)

// 创建者按人稳定着色；本人固定 jade，其余按展示名散列到 brass/slate/grey，与 P2 原型的 owner-mark 语言一致。
export function creatorVariant(name, mine) {
 if (mine) return 'mine'
 let hash = 0
 for (const char of String(name || '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0
 return ['brass', 'slate', 'grey'][hash % 3]
}

export function highlightedParts(value, query) {
 const text = String(value || '')
 const needle = query.trim()
 const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
 if (!needle || index < 0) return [{ text, hit: false }]
 return [
  { text: text.slice(0, index), hit: false },
  { text: text.slice(index, index + needle.length), hit: true },
  { text: text.slice(index + needle.length), hit: false },
 ].filter(part => part.text)
}

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null

function shortDateTime(iso) {
 const time = Date.parse(iso || '')
 if (!Number.isFinite(time)) return ''
 const d = new Date(time)
 const pad = n => String(n).padStart(2, '0')
 return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function environmentDetail(reading) {
 if (!reading || typeof reading !== 'object') return '读数未知'
 const parts = []
 if (finite(reading.temp) !== null) parts.push(`${reading.temp}°C`)
 if (finite(reading.humidity) !== null) parts.push(`湿度 ${reading.humidity}%`)
 if (finite(reading.pm25) !== null) parts.push(`PM2.5 ${reading.pm25}`)
 if (finite(reading.pm10) !== null) parts.push(`PM10 ${reading.pm10}`)
 const detail = parts.slice(0, 3).join(' · ') || '读数不全'
 return reading.source === 'shadow' ? `${detail} · 平台影子` : detail
}

function energyDetail(reading) {
 if (!reading || typeof reading !== 'object') return '暂无读数'
 const power = finite(reading.totalActivePower)
 const when = shortDateTime(reading.readTime)
 if (power !== null) return when ? `${power} kW · 读于 ${when}` : `${power} kW · 最新已知读数`
 return when ? `最新已知读数 · ${when}` : '读数不全'
}

function statePresentation(device, reading) {
 const value = reading?.state
 // 观察类语义：在线/读数/台账，不套通用开-关。
 if (device.kind === 'video') return {
  status: value === true ? 'on' : value === false ? 'off' : 'unknown',
  detail: value === true ? '在线' : value === false ? '离线' : '在线状态未知',
 }
 if (device.kind === 'environment') return { status: OBSERVE, detail: environmentDetail(value) }
 if (device.kind === 'energy') return { status: OBSERVE, detail: energyDetail(value) }
 if (device.kind === 'safety') return { status: OBSERVE, detail: '无实时状态 · 仅告警台账' }
 const power = typeof value === 'boolean' ? value : value && typeof value === 'object' ? value.power === 'on' ? true : value.power === 'off' ? false : null : null
 const status = power === true ? 'on' : power === false ? 'off' : 'unknown'
 const detail = device.kind === 'ac' && value && typeof value === 'object' && Number.isFinite(value.temperature)
  ? `${power === false ? '关闭' : power === true ? '运行' : '状态未知'} · ${value.temperature}℃`
  : power === true ? '开启' : power === false ? '关闭' : '状态未知'
 return { status, detail }
}

export function regionDeviceGroups(devices, readings, mode, query) {
 const needle = query.trim().toLocaleLowerCase()
 const groups = new Map()
 const ordered = [...devices].sort((a, b) => (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99) || a.name.localeCompare(b.name, 'zh-CN'))
 for (const device of ordered) {
  const kind = kindNames[device.kind] || kindNames.unknown
  const location = device.location || '位置未标注'
  const state = statePresentation(device, readings[device.id])
  if (needle && ![device.name, location, kind, state.detail].some(value => value.toLocaleLowerCase().includes(needle))) continue
  const group = mode === 'location' ? location : mode === 'status' ? isObservationKind(device.kind) ? '仅观察' : state.status === 'on' ? '运行中' : state.status === 'off' ? '已关闭' : '状态未知' : kind
  const art = resolveDeviceArtwork({ ...device, deviceName: device.name })
  if (!groups.has(group)) groups.set(group, [])
  groups.get(group).push({ ...device, kindLabel: kind, location, artwork: art.src, artVariant: art.variant, ...state,
   nameParts: highlightedParts(device.name, query), kindParts: highlightedParts(kind, query), locationParts: highlightedParts(location, query), detailParts: highlightedParts(state.detail, query) })
 }
 return [...groups].map(([label, items]) => ({ label, items }))
}
