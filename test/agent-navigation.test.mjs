import test from 'node:test'
import assert from 'node:assert/strict'
import { backToParent, returnToOfficeConversation } from '../pages/agent/navigation.mjs'
import { preserveComposerDraft, takeComposerDraft, preserveComposerReference, takeComposerReference, preserveComposerView, takeComposerView } from '../pages/agent/composer-drafts.mjs'

test('工作台新建任务只回办公室对话；没有办公室历史时保留上层栈并替换工作台', () => {
 const requests = []
 globalThis.uni = { navigateBack: request => requests.push(['back', request.delta]), redirectTo: request => requests.push(['replace', request.url]) }
 globalThis.getCurrentPages = () => [
  { route: 'pages/agent/dashboard' }, { route: 'pages/agent/index', options: { source: 'office' } },
  { route: 'pages/agent/index', options: { source: 'company' } }, { route: 'pages/agent/region' },
 ]
 returnToOfficeConversation()
 assert.deepEqual(requests.pop(), ['back', 2])
 globalThis.getCurrentPages = () => [{ route: 'pages/agent/dashboard' }, { route: 'pages/agent/region' }]
 returnToOfficeConversation()
 assert.deepEqual(requests.pop(), ['replace', '/pages/agent/index?source=office'])
 uni.navigateBack = request => request.fail()
 backToParent('/pages/agent/dashboard')
 assert.deepEqual(requests.pop(), ['replace', '/pages/agent/dashboard'])
 delete globalThis.uni; delete globalThis.getCurrentPages
})

test('阅读和编辑恢复按身份及来源隔离，换身份后旧草稿和引用一起失效', () => {
 const app = { globalData: {} }
 globalThis.getApp = () => app
 const view = { conversationId: 'office-c', scrollTop: 740, nearBottom: false, edit: { turnId: 't', content: '编辑中', stash: '原新消息草稿' } }
 preserveComposerDraft('identity-a', 'office', '原新消息草稿')
 preserveComposerReference('identity-a', 'office', { type: 'customer_alert', content: '引用' })
 preserveComposerView('identity-a', 'office', view)
 assert.equal(takeComposerView('identity-a', 'company'), null)
 assert.deepEqual(takeComposerView('identity-a', 'office'), view)
 assert.equal(takeComposerDraft('identity-a', 'office'), '原新消息草稿')
 preserveComposerView('identity-a', 'office', view)
 preserveComposerDraft('identity-a', 'office', '旧草稿')
 preserveComposerDraft('identity-b', 'office', '新身份草稿')
 assert.equal(takeComposerView('identity-b', 'office'), null)
 assert.equal(takeComposerReference('identity-b', 'office'), undefined)
 assert.equal(takeComposerView('identity-a', 'office'), null)
 assert.equal(takeComposerDraft('identity-a', 'office'), null)
 delete globalThis.getApp
})
