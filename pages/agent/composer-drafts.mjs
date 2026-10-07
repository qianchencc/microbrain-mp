const getDraftStore = () => {
	const app = getApp()
	const globalData = app.globalData || (app.globalData = {})
	return globalData.agentComposerDrafts || (globalData.agentComposerDrafts = { activeScope: '', drafts: new Map() })
}

function draftKey(store, scope, source) {
	if (!scope) return ''
	if (store.activeScope && store.activeScope !== scope) { store.drafts.clear(); store.references?.clear(); store.views?.clear() }
	store.activeScope = scope
	return `${scope}:${source}`
}

export function preserveComposerDraft(scope, source, value) {
	const store = getDraftStore()
	const key = draftKey(store, scope, source)
	if (key) store.drafts.set(key, value)
}

export function takeComposerDraft(scope, source) {
	const store = getDraftStore()
	const key = draftKey(store, scope, source)
	if (!key || !store.drafts.has(key)) return null
	const value = store.drafts.get(key)
	store.drafts.delete(key)
	return value
}

export function preserveComposerReference(scope, source, reference) {
	const store = getDraftStore(), key = draftKey(store, scope, source)
	if (!key) return
	store.references ||= new Map()
	store.references.set(key, reference ? { ...reference } : null)
}

export function takeComposerReference(scope, source) {
	const store = getDraftStore(), key = draftKey(store, scope, source)
	if (!key || !store.references?.has(key)) return undefined
	const reference = store.references.get(key)
	store.references.delete(key)
	return reference
}

// 页面卸载后的阅读位置与编辑态；按同一身份和来源隔离，不存会话正文或凭据。
export function preserveComposerView(scope, source, view) {
 const store = getDraftStore(), key = draftKey(store, scope, source)
 if (!key) return
 store.views ||= new Map()
 store.views.set(key, view)
}
export function takeComposerView(scope, source) {
 const store = getDraftStore(), key = draftKey(store, scope, source)
 if (!key || !store.views?.has(key)) return null
 const view = store.views.get(key)
 store.views.delete(key)
 return view
}
