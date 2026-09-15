export const CARD_HOLD_DELAY = 420
export const CARD_HOLD_PROGRESS = 560

export function createCardPress({ allowed, configure, select, progress }) {
 let timer, ticker, feedbackTimer, origin, suppress = false
 const point = touch => ({ x: touch.clientX ?? touch.pageX ?? touch.x, y: touch.clientY ?? touch.pageY ?? touch.y })
 function clear() { clearTimeout(timer); clearTimeout(feedbackTimer); clearInterval(ticker); origin = null; progress(null) }
 function cancel() { suppress = true; clear() }
 return {
  start(touches) {
   if (touches.length !== 1) { cancel(); return }
   clear(); suppress = false
   if (!allowed()) return
   const coordinates = point(touches[0])
   if (!Number.isFinite(coordinates.x) || !Number.isFinite(coordinates.y)) { cancel(); return }
   origin = { identifier: touches[0].identifier, ...coordinates }
   const started = Date.now()
   feedbackTimer = setTimeout(() => {
    progress(0)
    ticker = setInterval(() => progress(Math.min(360, (Date.now() - started - CARD_HOLD_DELAY) / CARD_HOLD_PROGRESS * 360)), 32)
   }, CARD_HOLD_DELAY)
   timer = setTimeout(() => {
    if (!allowed()) { cancel(); return }
    suppress = true
    clearInterval(ticker)
    progress(360)
    configure()
   }, CARD_HOLD_DELAY + CARD_HOLD_PROGRESS)
  },
  move(touches) {
   if (!origin) return
   const coordinates = touches.length === 1 ? point(touches[0]) : {}
   if (touches.length !== 1 || touches[0].identifier !== origin.identifier || !Number.isFinite(coordinates.x) || !Number.isFinite(coordinates.y) || Math.hypot(coordinates.x-origin.x,coordinates.y-origin.y) > 8) cancel()
  },
  end() { clear() },
  tap() { if (suppress) { suppress = false; return } select() },
  cancel,
  dispose: clear
 }
}
