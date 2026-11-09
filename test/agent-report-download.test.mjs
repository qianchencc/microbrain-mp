import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadReportFile } from '../apis/agent/report-download.mjs'
// @boundary-private-test-seam: tests the download adapter contract directly.

// 下载行为公开回归：注入 uni 风格 downloadFile/openDocument 适配器，不读 Vue 源码。
const adapters = (overrides = {}) => ({
 baseUrl: 'https://agent.test/api',
 getHeaders: () => ({ authorization: 'Bearer t', tenantcode: 'XSJ' }),
 getScope: () => 'scope-1',
 downloadFile: options => options.success({ statusCode: 200, tempFilePath: '/tmp/report.bin' }),
 openDocument: options => options.success({}),
 ...overrides,
})

test('默认 PDF 与表格分流：URL 格式参数与 openDocument.fileType 各自正确', async () => {
 const calls = { urls: [], opened: [] }
 const base = adapters({
  downloadFile: options => { calls.urls.push(options.url); options.success({ statusCode: 200, tempFilePath: '/tmp/f' }) },
  openDocument: options => { calls.opened.push(options.fileType); options.success({}) },
 })
 await downloadReportFile({ reportId: 'r-1' }, base)
 assert.ok(calls.urls[0].endsWith('/agent/reports/r-1/download?source=company'), '默认不带 format 参数保持旧兼容')
 assert.equal(calls.opened[0], 'pdf')
 await downloadReportFile({ reportId: 'r-1', format: 'xlsx' }, base)
 assert.ok(calls.urls[1].includes('format=xlsx'))
 assert.equal(calls.opened[1], 'xlsx')
})

test('非 200 使用服务端错误文字且不打开文件；缺 tempFilePath 同样拒绝', async () => {
 const opened = []
 const reason = '报告导出失败：编号 request-9'
 const original = globalThis.uni
 globalThis.uni = { getFileSystemManager: () => ({ readFile: options => options.success({ data: JSON.stringify({ message: reason }) }) }) }
 try {
  await assert.rejects(downloadReportFile({ reportId: 'r-1', format: 'xlsx' }, adapters({
   openDocument: options => { opened.push(options); options.success({}) },
   downloadFile: options => options.success({ statusCode: 503, tempFilePath: '/tmp/err' }),
  })), error => error.message === reason)
  await assert.rejects(downloadReportFile({ reportId: 'r-1' }, adapters({
   downloadFile: options => options.success({ statusCode: 200 }),
  })), /文件无效/)
 } finally { globalThis.uni = original }
 assert.equal(opened.length, 0, '失败响应不调用 openDocument')
})

test('身份变化与视图失活的迟到响应都不打开文件', async () => {
 const opened = []
 const success = options => options.success({ statusCode: 200, tempFilePath: '/tmp/f' })
 let scope = 'scope-1'
 await assert.rejects(downloadReportFile({ reportId: 'r-1' }, adapters({
  getScope: () => scope,
  openDocument: options => { opened.push(1); options.success({}) },
  downloadFile: options => { scope = 'scope-2'; success(options) },
 })), error => error.data?.code === 'SCOPE_CHANGED')
 let active = true
 await assert.rejects(downloadReportFile({ reportId: 'r-1' }, adapters({
  isActive: () => active,
  openDocument: options => { opened.push(1); options.success({}) },
  downloadFile: options => { active = false; options.success({ statusCode: 200, tempFilePath: '/tmp/f' }) },
 })), error => error.data?.code === 'REPORT_VIEW_INACTIVE')
 assert.equal(opened.length, 0)
})

test('非法格式与缺 id 直接拒绝，不发起下载', async () => {
 const requested = []
 await assert.rejects(downloadReportFile({ reportId: 'r-1', format: 'csv' }, adapters({
  downloadFile: options => { requested.push(1); options.success({ statusCode: 200, tempFilePath: '/tmp/f' }) },
 })), /格式不支持/)
 await assert.rejects(downloadReportFile({}, adapters()), /报告标识/)
 assert.equal(requested.length, 0)
})

test('openDocument 同步抛错使 Promise 有界拒绝，不悬挂', async () => {
 await assert.rejects(downloadReportFile({ reportId: 'r-1' }, adapters({
  openDocument: () => { throw new Error('openDocument 不可用') },
 })), /openDocument 不可用/)
 await assert.rejects(downloadReportFile({ reportId: 'r-1' },
 { baseUrl: 'x', getHeaders: () => ({}), getScope: () => 's' }), /仅支持小程序内查看/, '缺少适配器直接拒绝')
})
