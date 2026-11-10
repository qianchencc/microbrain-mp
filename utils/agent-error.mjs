// 用户可见错误的统一收口：任何错误对象/后端原文进来，出去的都是一行短文案。
// 规则：错误一律以 toast 弹出并消失；页面内联处只留固定短标签（'读取失败'/'暂不可用'）
// 加重试按钮，完整原因只允许进「查看原因」详情。新报错点必须走 showAgentError，
// 不得再把 error.message / 后端原文直接渲染进页面。
const PATTERN_RULES = [
  [/准备中|preparing/i, '数据准备中，请稍后重试'],
  [/会话身份已变化|登录已变化|身份已变化|已失效，请重新读取/, '登录已变化，请重新读取'],
  [/已失效|过期|session.*expired/i, '登录已过期，请重新进入'],
  [/无权限|无权|不在.*范围|forbidden|outside/i, '暂无权限'],
  [/不存在|未找到|not.?found/i, '记录不存在或已删除'],
  [/已变化|版本冲突|stale|conflict/i, '数据已变化，请刷新后重试'],
  [/超时|timeout|timed.?out/i, '请求超时，稍后重试'],
  [/网络|network|err_(internet|connection|network)|request:fail|abort/i, '网络异常，稍后重试'],
];

// 后端错误码 → 短文案。码名含语义，UI 不再展示后端拼好的长句。
const CODE_RULES = [
  [/^(TASK_DEVICE_UNAVAILABLE|PLAN_SCOPE_CHANGED)$/, '设备范围已变化，请重新核实'],
  [/PREPARING|NOT_READY/, '数据准备中，请稍后重试'],
  [/SESSION_EXPIRED/, '登录已过期，请重新进入'],
  [/SCOPE_CHANGED|IDENTITY/, '登录已变化，请重新读取'],
  [/OUTSIDE_SCOPE|FORBIDDEN|SOURCE_UNAVAILABLE|REGION_UNAVAILABLE|FOCUS_REGION/, '暂无权限'],
  [/NOT_FOUND|NO_LONGER/, '记录不存在或已删除'],
  [/STALE|CONFLICT|CANDIDATE/, '数据已变化，请刷新后重试'],
  [/TIMEOUT|TIMED_OUT/, '上游超时，稍后重试'],
  [/UPSTREAM|UNAVAILABLE|INCOMPLETE|READ_FAILED/, '上游暂不可用，稍后重试'],
  [/INVALID|QUERY|CURSOR|WINDOW|REFERENCE/, '参数无效'],
  [/VIEW_INACTIVE/, '内容已关闭，请重新打开'],
];

const classifyMessage = (message, timeoutText) => {
  for (const [pattern, text] of PATTERN_RULES) {
    if (pattern.test(message)) return text === '请求超时，稍后重试' ? timeoutText : text;
  }
  return '';
};

/**
 * 任意错误归并为一句短文案。
 * @param cause Error | {code,message,status,data} | string | null
 * @param options.fallback 归并不出时使用，默认 '操作失败，请重试'
 * @param options.timeout 命中超时类的文案，供「回答超时，请重试」等场景覆盖
 */
export function agentErrorText(cause, { fallback = '操作失败，请重试', timeout } = {}) {
  if (!cause) return fallback;
  const object = typeof cause === 'object' ? cause : { message: String(cause) };
  const code = String(object.code || object.data?.code || '');
  const status = object.status ?? object.data?.status ?? object.statusCode;
  if (code === 'TASK_DEVICE_AUTHORIZATION_UNAVAILABLE' && status === 403) {
    return '设备范围已变化，请重新核实';
  }
  for (const [pattern, text] of CODE_RULES) {
    if (pattern.test(code)) return text;
  }
  const message = String(object.message || object.data?.message || '');
  if (object.transport || status === 0) {
    return classifyMessage(message, timeout || '请求超时，稍后重试') || '网络异常，稍后重试';
  }
  if (status === 401 || status === 403) return '暂无权限';
  if (status === 404) return '记录不存在或已删除';
  if (status === 409) return '数据已变化，请刷新后重试';
  if (status === 429) return '请求过于频繁，请稍后重试';
  if (typeof status === 'number' && status >= 500) {
    if (/上游/.test(message)) return '上游暂不可用，稍后重试';
    return classifyMessage(message, timeout || '后端超时，稍后重试') || '后端异常，稍后重试';
  }
  return classifyMessage(message, timeout || '请求超时，稍后重试') || fallback;
}

let lastToast = { text: '', at: 0 };

/**
 * 错误统一以 toast 弹出。同一文案 4 秒内不重复弹（重试风暴不刷屏）。
 */
export function showAgentError(cause, options = {}) {
  const text = agentErrorText(cause, options);
  const now = Date.now();
  if (text === lastToast.text && now - lastToast.at < 4000) return;
  lastToast = { text, at: now };
  uni.showToast({ title: text, icon: 'none', duration: 2200 });
}
