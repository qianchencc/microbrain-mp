// 微信原生 input/textarea 的 IME 回声抑制。
// bindinput 在拼音组合中态也会触发，detail.value 携带原始拼音（如 "suo'you'd"）；
// 若此时把 value 写回原生层，等同于强制提交组合中文字——拼音上屏、候选字丢失。
// 用法：@input 时 track() 记录字段实况；外部值回流时用 shouldWrite() 判定——
// 只有非本次输入回声的程序性改写（发送后清空、恢复草稿等）才允许写 :value。
export function createFieldEchoGuard(initial = '') {
  let lastText = initial
  return {
    track(value) { lastText = value },
    shouldWrite(value) {
      if (value === lastText) return false
      lastText = value
      return true
    },
  }
}
