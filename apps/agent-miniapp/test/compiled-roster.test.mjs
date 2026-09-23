import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const components = new URL('../unpackage/dist/build/mp-weixin/pages/agent/components/', import.meta.url)
const read = name => readFile(new URL(name, components), 'utf8')

test('概览与草案合并为单个 ActionPanel 挂载，草案卡不再独立出现', async () => {
	const [surface, panel] = await Promise.all([read('AgentReplySurface.wxml'), read('ActionPanel.wxml')])
	assert.match(surface, /action-panel/, '回复面必须挂载统一面板')
	assert.doesNotMatch(surface, /device-roster|action-draft-card/, '清单与草案卡不得再独立挂载')
	assert.match(panel, /device-roster/, '概览页缺失')
	assert.match(panel, /action-draft-card/, '内嵌草案页缺失')
})

test('面板：分段控件 + 共享速览条 + 固定体高 + 常驻底栏相位', async () => {
	const [wxml, wxss] = await Promise.all([read('ActionPanel.wxml'), read('ActionPanel.wxss')])
	assert.match(wxml, /seg__item/, '分段控件缺失')
	assert.match(wxml, /panel-stats/, '速览条缺失')
	assert.match(wxml, /panel-foot/, '常驻底栏缺失')
	assert.match(wxml, /scroll-view/, '草案页内部滚动缺失')
	assert.match(wxml, /hidden=/, '页签切换必须走 hidden 保活而非重建')
	const body = wxss.match(/\.panel-body[\w.-]*\s*\{[^}]*\}/)?.[0] ?? ''
	assert.match(body, /height:\d+px/, '面板体必须固定高度')
	assert.match(body, /overflow:hidden/, '面板体溢出必须裁切')
})

test('概览列表：scroll-view + mask 渐隐 + v 游标，禁色带覆盖层', async () => {
	const [wxml, wxss] = await Promise.all([read('DeviceRoster.wxml'), read('DeviceRoster.wxss')])
	assert.match(wxml, /scroll-view/, '概览必须是内部滚动列表')
	assert.match(wxml, /roster-thumb/, '裸图行首标记缺失')
	assert.match(wxml, /roster-cue/, 'v 游标缺失')
	assert.match(wxml, /roster-cue__icon/, '游标图标缺失')
	assert.match(wxss, /mask-image/, '边缘渐隐必须走 mask')
	assert.doesNotMatch(wxss, /linear-gradient\(to bottom, rgba\(252,253,252/, '禁止色带式覆盖渐隐')
	const thumb = wxss.match(/\.roster-thumb[\w.-]*\s*\{[^}]*\}/)?.[0] ?? ''
	assert.match(thumb, /height:24px/, '裸图按 24px 高约束')
	assert.doesNotMatch(thumb, /border|border-radius/, '裸图禁止外框')
})

test('迁移链行三槽纪律：禁 flex-wrap，名槽收缩省略，状态/意图槽封顶省略', async () => {
	const wxss = await read('DeviceRoster.wxss')
	const row = wxss.match(/\.roster-row[\w.-]*\s*\{[^}]*\}/)?.[0] ?? ''
	assert.doesNotMatch(row, /flex-wrap/, '清单行禁止 flex-wrap')
	assert.match(wxss, /\.roster-name[\w.-]*\s*\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis[^}]*\}/)
	for (const slot of ['roster-state', 'roster-act']) {
		const rule = wxss.match(new RegExp(`\\.${slot}[\\w.-]*\\s*\\{[^}]*\\}`))?.[0] ?? ''
		assert.match(rule, /flex-shrink:0/, `${slot} 不得收缩`)
		assert.match(rule, /max-width/, `${slot} 必须有宽度封顶`)
	}
	assert.match(wxss, /\.roster-row\s*\+\s*\.roster-row[\w.-]*:before/, '行分隔 hairline 必须从行左缘内缩')
})
