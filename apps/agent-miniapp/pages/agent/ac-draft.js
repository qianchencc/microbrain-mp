export const modeLabels = { auto: "自动", cool: "制冷", heat: "制热", dry: "除湿", fan: "送风" };
export const fanLabels = { low: "低风", high: "高风", auto: "自动风" };
export const fieldLabels = { power: "电源", temperature: "设定温度", mode: "模式", fanSpeed: "风速" };

export function acSummary(command = {}) {
  return [command.power === "on" ? "开启" : command.power === "off" ? "关闭" : null,
    modeLabels[command.mode], command.temperature != null ? `${command.temperature}°C` : null, fanLabels[command.fanSpeed]].filter(Boolean).join(" · ");
}

export function operationLabel(action) {
  if (action.kind === "access") return "开门一次";
  return action.kind === "ac" ? acSummary(action.command) : action.command.closeOrOpen === 1 ? "开启" : "关闭";
}

// 步长不细于 1°C（2026-09-17 实测：网关受理 24.5 但物理设备只落整数）；
// 旧草案 parameters 残留 0.5/0.1 时同样按整数网格编辑，与服务端整数校验一致。
export function acTemperatureStep(actions) {
  return Math.max(1, ...actions.map(a => a.parameters?.temperature.step ?? 1));
}

export function effectiveSettings(action, states, edits = {}) {
  const state = states[action.deviceId];
  return { ...(state && typeof state === "object" ? state : {}), ...action.command, ...edits[action.id] };
}

export function commonSetting(actions, states, edits, field) {
  const values = actions.map(action => effectiveSettings(action, states, edits)[field]);
  return values.length && values.every(value => value === values[0]) ? values[0] ?? "" : "";
}

export function editSettings(edits, actions, field, value, states = {}) {
  const next = { ...edits };
  for (const action of actions) {
    next[action.id] = value === "off" && field === "power" ? { power: "off" } : { ...next[action.id], [field]: value };
    const baseline = effectiveSettings(action, states);
    const replacesRunningTarget = field === "power" && value === "off" && Object.keys(action.command).some(key => key !== "power");
    if (value === baseline[field] && !replacesRunningTarget) delete next[action.id][field];
    if (!Object.keys(next[action.id]).length) delete next[action.id];
  }
  return next;
}

export function settingStatus(actions, states, edits, field) {
  const values = actions.map(action => effectiveSettings(action, states, edits)[field]);
  if (!values.length || values.every(value => value == null)) return "未知";
  if (values.some(value => value == null)) return "部分未知";
  return values.every(value => value === values[0]) ? "" : "多种设置";
}
