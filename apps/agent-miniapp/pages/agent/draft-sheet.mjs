// 面板门控：只有待确认草案可以打开配置面板；状态推进或草案被替换时视为关闭。
export function sheetDraftFrom(turns, draftId) {
 if (!draftId) return null
 const draft = turns.find(turn => turn.draft?.draftId === draftId)?.draft
 return draft && draft.status === 'PENDING_CONFIRMATION' ? draft : null
}
