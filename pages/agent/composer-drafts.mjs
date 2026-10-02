const getDraftStore = () => {
	const app = getApp()
	const globalData = app.globalData || (app.globalData = {})
	return globalData.agentComposerDrafts || (globalData.agentComposerDrafts = { activeScope: '', drafts: new Map() })
}

function draftKey(store, scope, source) {
	if (!scope) return ''
	if (store.activeScope && store.activeScope !== scope) store.drafts.clear()
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
