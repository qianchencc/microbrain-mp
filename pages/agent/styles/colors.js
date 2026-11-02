// 物联助手颜色 token 的 JS 字面量镜像。
// 供 uni 原生 API 参数（confirmColor、switch color）、动态 SVG 字符串等
// 无法接受 CSS 变量的位置使用；与 _tokens.scss / tokens.css 同源，
// 一致性由 test/agent-tokens.test.mjs 校验。
export const AGENT_COLORS = {
  accent: '#466eae',
  accentDeep: '#315a80',
  accentFaint: '#eaf1fc',
  surfacePage: '#f3f6fa',
  tint: '#e6eef8',
  surface: '#ffffff',
  textPrimary: '#263332',
  textSecondary: '#516b85',
  textMuted: '#718496',
  textFaint: '#8b9ba8',
  line: '#e2e9f0',
  success: '#3f8a66',
  successFaint: '#e8f2ec',
  warning: '#a27128',
  warningDeep: '#8e650f',
  warningFaint: '#f6eed6',
  error: '#a15343',
  errorFaint: '#f4e5e0',
  badge: '#b4553f',
  chart: '#a8c4e8',
  chartDeep: '#719ed8',
  mask: 'rgba(0, 0, 0, 0.4)'
}
