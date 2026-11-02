// Agent 头像为固定预计算 SVG（原 blobatar 固定 seed 的导出结果），不引入 blobatar/text-encoding 依赖。
const source = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
const body = source('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M86.87 51.49C86.87 72.77 72.95 86.23 50.94 86.23C28.93 86.23 15.01 72.77 15.01 51.49C15.01 30.21 28.93 16.75 50.94 16.75C72.95 16.75 86.87 30.21 86.87 51.49Z" fill="#466eae"/></svg>')
const eyes = source('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M42.78 51.23C42.08 59.32 42.08 59.32 38.58 59.02C35.07 58.72 35.07 58.72 35.77 50.63C36.46 42.53 36.46 42.53 39.97 42.83C43.47 43.13 43.47 43.13 42.78 51.23Z" fill="#f5f9ff"/><path d="M67.02 51.52C66.02 63.22 66.02 63.22 61.72 62.86C57.42 62.49 57.42 62.49 58.42 50.79C59.42 39.08 59.42 39.08 63.72 39.45C68.02 39.82 68.02 39.82 67.02 51.52Z" fill="#f5f9ff"/></svg>')
export function avatarLayers() { return { body, eyes } }
