import { resolveDeviceArtwork } from './device-art/catalog.js'

const kindNames = { lighting: '照明', ac: '空调', access: '门禁', video: '视频', environment: '环境', energy: '能耗', safety: '安全', unknown: '其他' }
const kindOrder = { lighting: 0, ac: 1, access: 2, video: 3, environment: 4, energy: 5, safety: 6, unknown: 7 }

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

function statePresentation(device, reading) {
 const value = reading?.state
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
  const group = mode === 'location' ? location : mode === 'status' ? state.status === 'on' ? '运行中' : state.status === 'off' ? '已关闭' : '状态未知' : kind
  if (!groups.has(group)) groups.set(group, [])
  groups.get(group).push({ ...device, kindLabel: kind, location, artwork: resolveDeviceArtwork({ ...device, deviceName: device.name }).src, ...state,
   nameParts: highlightedParts(device.name, query), kindParts: highlightedParts(kind, query), locationParts: highlightedParts(location, query), detailParts: highlightedParts(state.detail, query) })
 }
 return [...groups].map(([label, items]) => ({ label, items }))
}
