import { AGENT_COLORS } from '../../styles/colors.js'

export const HOUR_PX = 34
export const TOP_PAD = 44
const DAY_MS = 86400000
const round = value => Math.round(value * 10) / 10
const midnight = date => Date.parse(`${date}T00:00:00+08:00`)
export const localDate = instant => new Date(new Date(instant).getTime() + 8 * 3600000).toISOString().slice(0, 10)
export const localTime = instant => new Date(new Date(instant).getTime() + 8 * 3600000).toISOString().slice(11, 16)
export const timelineYOf = (instant, firstDate) => TOP_PAD + (new Date(instant).getTime() - midnight(firstDate)) / 3600000 * HOUR_PX
export const railX = (y, peakY) => 55.5 + 8.5 * Math.cos(2 * Math.PI * (y - peakY) / 221)

// 点击日期的落点：优先当天的第一个任务卡，空日仍停在当天 00:00（不看跨日任务的中间卡）。
export const firstDayCard = (cards, date) => cards.filter(card => localDate(card.at) === date).sort((a, b) => a.top - b.top)[0]
export const dateFocusTop = ({ cards = [], date, dayIndex = 0 }) => {
 const first = firstDayCard(cards, date)
 return Math.max(0, (first ? first.top : TOP_PAD + dayIndex * 24 * HOUR_PX) - 30)
}

// 输出绘图命令和普通视图的坐标；不依赖 DOM、Canvas 或小程序 API。
export function createTimeline({ date, items = [], now = new Date().toISOString(), width = 340, days = 1 }) {
 const height = TOP_PAD * 2 + days * 24 * HOUR_PX
 const yOf = instant => timelineYOf(instant, date)
 const viewportBottom = height - TOP_PAD
 const nowY = yOf(now)
 const peakY = yOf(`${localDate(now)}T10:30:00+08:00`)
 const xOf = y => railX(y, peakY)
 const shapes = []
 const path = (commands, style) => shapes.push({ type: 'path', commands, ...style })
 const circle = (x, y, r, fill, stroke, lineWidth) => shapes.push({ type: 'circle', x: round(x), y, r, fill, stroke, lineWidth })
 const rect = (x, y, w, h, r, fill) => shapes.push({ type: 'rect', x: round(x), y: round(y), w, h, r, fill })
 const disk = (x, y, outer, inner, fill) => { circle(x, y, outer, '#fff'); circle(x, y, inner, fill) }
 const ring = (x, y, color, outer = 7, inner = 5.1, lineWidth = 2) => { circle(x, y, outer, '#fff'); circle(x, y, inner, '#fff', color, lineWidth) }
 const sampled = (start, end) => {
  const ys = []
  for (let y = start; y < end; y += 2) ys.push(y)
  ys.push(end)
  return ys
 }
 const rail = sampled(0, height).map((y, i) => [i ? 'L' : 'M', round(xOf(y)), y])
 path(rail, { stroke: AGENT_COLORS.line, lineWidth: 1.6 })
 path(rail, { stroke: AGENT_COLORS.chart, lineWidth: 1.6, clipY: Math.max(0, nowY) })

 const events = items.map(item => {
  const rawY = yOf(item.at), rawEndY = item.endAt ? yOf(item.endAt) : null
  const interval = rawEndY !== null && rawEndY > rawY
  return { ...item, rawY, rawEndY, interval,
   y: interval ? Math.max(TOP_PAD, rawY) : rawY,
   endY: interval ? Math.min(viewportBottom, rawEndY) : null,
   startVisible: rawY >= TOP_PAD && rawY < viewportBottom,
   endVisible: rawEndY !== null && rawEndY >= TOP_PAD && rawEndY < viewportBottom }
 }).filter(item => item.interval ? item.rawY < viewportBottom && item.rawEndY >= TOP_PAD : item.startVisible)
 const intervals = events.filter(item => item.endY !== null && item.endY > item.y)
 const anchors = events.flatMap(item => [
  ...(item.startVisible ? [item.y] : []), ...(item.endVisible ? [item.endY] : [])
 ])
 const ticks = []
 for (let day = 0; day < days; day++) for (let hour = 0; hour < 24; hour += 3) {
  const y = TOP_PAD + (day * 24 + hour) * HOUR_PX
  if (intervals.some(item => y >= item.y && y <= item.endY) || anchors.some(anchor => Math.abs(anchor - y) < 18) || Math.abs(nowY - y) < 14) continue
  ticks.push({ y, text: `${String(hour).padStart(2, '0')}:00`, kind: y < nowY ? 'tick past' : 'tick' })
  rect(xOf(y) - 5, y - 3.2, 10, 6.4, 3.2, '#fff')
  rect(xOf(y) - 3.2, y - 1.7, 6.4, 3.4, 1.7, y < nowY ? AGENT_COLORS.chart : AGENT_COLORS.line)
 }
 const exact = events.flatMap(item => [
  ...(item.startVisible ? [{ y: item.y, text: localTime(item.at), kind: 'event' }] : []),
  ...(item.endVisible ? [{ y: item.endY, text: localTime(item.endAt), kind: 'event' }] : [])
 ]).filter((item, index, all) => all.findIndex(other => other.y === item.y) === index)
 const labels = [...exact, ...ticks].sort((a, b) => a.y - b.y).map(item => ({ ...item, displayY: item.y }))
 for (let pass = 0; pass < 3; pass++) for (let i = 1; i < labels.length; i++) {
  const a = labels[i - 1], b = labels[i], overlap = 18 - (b.displayY - a.displayY)
  if (overlap > 0) { a.displayY -= overlap / 2; b.displayY += overlap / 2 }
 }
 labels.forEach(label => {
  if (Math.abs(label.y - label.displayY) > 2) path([['M', 38, round(label.displayY)], ['L', round(xOf(label.y) - 8), label.y]], { stroke: AGENT_COLORS.line, lineWidth: .9 })
 })
 const ribbonPoint = (y, from, to) => {
  const slope = (xOf(y + 1) - xOf(y - 1)) / 2, nx = 1 / Math.hypot(1, slope), ny = -slope * nx
  const width = 1.5 + 9.5 * Math.pow(Math.max(0, Math.sin(Math.PI * (y - from) / (to - from))), 1.4)
  return { left: [round(xOf(y)), round(y)], right: [round(xOf(y) + width * nx), round(y + width * ny)] }
 }
 intervals.forEach(item => {
  const points = sampled(item.y, item.endY).map(y => ribbonPoint(y, item.rawY, item.rawEndY))
  const commands = points.map((p, i) => [i ? 'L' : 'M', ...p.left]).concat(points.slice().reverse().map(p => ['L', ...p.right]), [['Z']])
  path(commands, { fill: 'future' })
  if (nowY > item.y) path(commands, { fill: 'elapsed', clipY: Math.max(0, nowY) })
 })
 let previousBottom = -1
 const cards = events.slice().sort((a, b) => a.y - b.y).map(item => {
  const cardY = item.interval && !item.startVisible ? (item.y + item.endY) / 2 : item.y
  const top = Math.max(cardY - 16, previousBottom)
  previousBottom = top + 40
  const anchorY = item.endY === null ? item.y : (item.y + item.endY) / 2
  const x1 = Math.min(xOf(anchorY) + (item.endY === null ? 5 : 13), 78)
  path([['M', round(x1), anchorY], ['C', round(x1 + 12), anchorY, 70, top + 16, 82, top + 16]], { stroke: item.faded ? AGENT_COLORS.tint : AGENT_COLORS.line, lineWidth: 1 })
  return { ...item, top }
 })
 const nowVisible = nowY >= TOP_PAD && nowY < height - TOP_PAD
 if (nowVisible) {
  const edges = intervals.filter(item => item.y <= nowY && nowY < item.endY).map(item => ribbonPoint(nowY, item.y, item.endY).right[0] + 4)
  const start = Math.max(xOf(nowY) + 9, ...edges)
  path([['M', round(start), nowY], ['L', width - 14, nowY]], { stroke: AGENT_COLORS.warning, lineWidth: 1, dash: [4, 5], opacity: .68 })
 }
 const starts = new Set(events.filter(item => item.interval && item.startVisible).map(item => item.y))
 events.filter(item => item.endY === null && !starts.has(item.y)).forEach(item => {
  if (item.y <= nowY) disk(xOf(item.y), item.y, 5.8, 3.9, AGENT_COLORS.chart)
  else ring(xOf(item.y), item.y, AGENT_COLORS.textFaint, 5.8, 3.9, 1.6)
 })
events.filter(item => item.interval && item.startVisible).forEach(item => disk(xOf(item.y), item.y, 7.1, 5.2, item.y <= nowY ? AGENT_COLORS.accentDeep : AGENT_COLORS.chart))
events.filter(item => item.interval && item.endVisible).forEach(item => ring(xOf(item.endY), item.endY, item.endY <= nowY ? AGENT_COLORS.accentDeep : AGENT_COLORS.chart))
 if (nowVisible) disk(xOf(nowY), nowY, 7.5, 5.2, AGENT_COLORS.warningDeep)
 const showNowLabel = nowVisible && labels.every(label => Math.abs(label.displayY - nowY) >= 25)
 const dates = Array.from({ length: days }, (_, day) => ({ date: localDate(midnight(date) + day * DAY_MS), y: TOP_PAD + day * 24 * HOUR_PX }))
 return { width, height: Math.max(height, previousBottom + TOP_PAD), shapes, labels, cards, dates, nowY, nowVisible, nowText: localTime(now), showNowLabel }
}
