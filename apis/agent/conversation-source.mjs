export const withConversationSource = (path, source = 'office') => {
	if (source !== 'company') return path
	return `${path}${path.includes('?') ? '&' : '?'}source=company`
}

export const conversationSourceBody = (source = 'office') => ({ source })
