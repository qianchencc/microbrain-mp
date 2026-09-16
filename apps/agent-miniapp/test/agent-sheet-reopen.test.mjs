// DeviceSheet 重开状态机回归：uni-popup 的 open() 在其关闭动画结束前会静默返回且不发事件，
// 本测试以契约级模拟（uni-popup 开合时序 + DeviceSheet 现行逻辑，见 DeviceSheet.vue 的 ensureOpen）
// 验证「打开 → 拖拽/遮罩收起 → 任意延迟重开」不再产生死态。
// 修改 DeviceSheet.vue 开合逻辑时必须同步本文件里的 wrapper 移植。
import assert from 'node:assert/strict'
import test from 'node:test'

// —— 虚拟时钟 ——
function createClock() {
  let now = 0, seq = 1
  const timers = new Map(), microtasks = []
  return {
    setTimeout(fn, ms) { const id = seq++; timers.set(id, { due: now + ms, fn }); return id },
    clearTimeout(id) { timers.delete(id) },
    nextTick(fn) { microtasks.push(fn) },
    async flush() { while (microtasks.length) microtasks.shift()() },
    advance(ms) {
      const target = now + ms
      for (;;) {
        const entry = [...timers.entries()].filter(([, t]) => t.due <= target).sort((a, b) => a[1].due - b[1].due)[0]
        if (!entry) break
        const [id, t] = entry
        now = t.due; timers.delete(id); t.fn()
        // 真实事件循环语义：每个宏任务（定时器）结束后清空微任务（nextTick）队列
        while (microtasks.length) microtasks.shift()()
      }
      now = target
    },
  }
}

// —— uni-popup@1.5.12 契约（open 守卫 / close 300ms / 同步 change）——
function createUniPopup(clock) {
  const popup = {
    showPopup: false, showTrans: false, timer: null,
    listeners: [],
    $emit(_event, payload) { for (const l of popup.listeners) l(payload) },
    onChange(l) { popup.listeners.push(l) },
    open(direction = 'bottom') {
      if (popup.showPopup) return                                   // 静默 no-op：既不显示也不发事件
      clock.nextTick(() => { popup.showPopup = true; popup.showTrans = true })
      popup.$emit('change', { show: true, type: direction })
    },
    close() {
      popup.showTrans = false
      popup.$emit('change', { show: false, type: 'bottom' })
      clock.clearTimeout(popup.timer)
      popup.timer = clock.setTimeout(() => { popup.showPopup = false }, 300)
    },
    onTap() { popup.close() },                                       // 遮罩点击
  }
  return popup
}

// —— DeviceSheet 现行逻辑移植（ensureOpen 反馈重试版）——
function createDeviceSheet(clock, popup, onClose) {
  const sheet = {
    props: { open: false },
    visible: false, requestedClose: false, reopenTimer: null,
    async setOpen(value) {
      const was = sheet.props.open
      sheet.props.open = value
      if (was === value) return
      if (value) {
        sheet.requestedClose = false
        await clock.flush()                                          // await nextTick()
        if (sheet.props.open) sheet.ensureOpen()
      } else if (sheet.visible) {
        sheet.requestedClose = true
        sheet.stopReopen()
        popup.close()
      }
    },
    ensureOpen() {
      sheet.stopReopen()
      if (!sheet.props.open) return
      popup.open('bottom')
      sheet.reopenTimer = clock.setTimeout(() => { if (sheet.props.open && !sheet.visible) sheet.ensureOpen() }, 350)
    },
    stopReopen() { clock.clearTimeout(sheet.reopenTimer) },
    onPopupChange(event) {
      sheet.visible = event.show
      if (event.show) { sheet.stopReopen(); return }
      if (sheet.props.open && !sheet.requestedClose) { sheet.requestedClose = true; onClose() }
    },
    dismissFromHandle() {                                            // WXS callMethod 入口
      if (!sheet.props.open || sheet.requestedClose) return
      sheet.requestedClose = true
      sheet.stopReopen()
      popup.close()
      onClose()
    },
  }
  popup.onChange(event => sheet.onPopupChange(event))
  return sheet
}

async function runScenario({ dismiss = 'drag', retapDelays = [] }) {
  const clock = createClock()
  const popup = createUniPopup(clock)
  let closes = 0
  let sheet
  // 父级行为：面板请求关闭时清空 draft（props.open → false），重开时重新置 true
  const parentClose = () => { closes++; void sheet.setOpen(false) }
  sheet = createDeviceSheet(clock, popup, parentClose)
  const results = []
  const visible = () => popup.showPopup && popup.showTrans

  await sheet.setOpen(true); await clock.flush(); clock.advance(400)
  results.push(['first-open', visible()])

  if (dismiss === 'drag') sheet.dismissFromHandle()
  else popup.onTap()
  await clock.flush(); clock.advance(400)
  results.push(['dismissed', !visible()])

  for (const [i, delay] of retapDelays.entries()) {
    clock.advance(delay)
    await sheet.setOpen(true); await clock.flush(); clock.advance(1200)
    results.push([`retap-${i}@+${delay}ms`, visible()])
  }
  return results
}

test('拖拽收起后任意延迟重开（含 300ms 内的吞调用窗口）都恢复打开', async () => {
  for (const delay of [100, 250, 350, 1000]) {
    const results = await runScenario({ dismiss: 'drag', retapDelays: [delay] })
    for (const [step, ok] of results) assert.ok(ok, `拖拽收起 +${delay}ms 重开：${step} 失败`)
  }
})

test('拖拽收起后连续多次重开尝试（每次都落在关闭窗口内）最终恢复', async () => {
  const results = await runScenario({ dismiss: 'drag', retapDelays: [100, 100, 100] })
  assert.deepEqual(results.map(([, ok]) => ok), [true, true, true, true, true])
})

test('遮罩关闭后重开恢复打开', async () => {
  for (const delay of [150, 1000]) {
    const results = await runScenario({ dismiss: 'mask', retapDelays: [delay] })
    for (const [step, ok] of results) assert.ok(ok, `遮罩关闭 +${delay}ms 重开：${step} 失败`)
  }
})

test('打开后立刻要求关闭：不残留重开定时器，面板保持关闭', async () => {
  const clock = createClock()
  const popup = createUniPopup(clock)
  const sheet = createDeviceSheet(clock, popup, () => {})
  await sheet.setOpen(true); await clock.flush()
  await sheet.setOpen(false); await clock.flush(); clock.advance(1000)
  assert.equal(popup.showPopup && popup.showTrans, false, '不应重新打开')
})

test('重开确认（change show:true）后不再重复调用 open', async () => {
  const clock = createClock()
  const popup = createUniPopup(clock)
  let openCalls = 0
  const realOpen = popup.open
  popup.open = direction => { openCalls++; realOpen.call(popup, direction) }
  const sheet = createDeviceSheet(clock, popup, () => {})
  await sheet.setOpen(true); await clock.flush()
  clock.advance(1500)
  assert.equal(openCalls, 1, '面板已打开并确认后不应再有重试调用')
})
