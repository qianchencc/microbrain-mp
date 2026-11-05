// 微信原生 input/textarea 的 IME 回声抑制。
// bindinput 在拼音组合中态也会触发，detail.value 携带原始拼音（如 "suo'you'd"）；
// 若此时把 value 写回原生层，等同于强制提交组合中文字——拼音上屏、候选字丢失。
// 用法：@input 时 track() 记录字段实况；外部值回流时用 plan() 取写回步骤——
// 回声返回 []（不写），普通程序性改写返回 [value]，而"目标值恰等于已写入值"
// （典型：发送后清空 '' 与初始 '' 相同）返回 [shown, value] 两步——Vue 对同值
// prop 不重渲染，必须先写当前显示值制造 diff，原生层才收到目标值。
export function fieldWriteSteps(shown, written, target) {
  if (target === shown) return [];
  return target === written ? [shown, target] : [target];
}

export function createFieldEchoGuard(initial = '') {
  let lastText = initial;
  return {
    track(value) {
      lastText = value;
    },
    peek() {
      return lastText;
    },
    plan(target, written) {
      const steps = fieldWriteSteps(lastText, written, target);
      if (steps.length) lastText = target;
      return steps;
    },
    shouldWrite(value) {
      if (value === lastText) return false;
      lastText = value;
      return true;
    },
  };
}
