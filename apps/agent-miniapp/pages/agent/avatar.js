function source(drawing) {
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${drawing}</svg>`)
}

const body = source([
	'<path d="M50 10C75.5 10 90 24.5 90 50S75.5 90 50 90 10 75.5 10 50 24.5 10 50 10Z" fill="#176b54"/>',
	'<path d="M22 29C30 17 43 14 56 15" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>',
].join(''))
const eyes = source([
	'<rect x="33" y="39" width="8" height="22" rx="4" fill="#e9fff4"/>',
	'<rect x="59" y="39" width="8" height="22" rx="4" fill="#e9fff4"/>',
].join(''))

export function avatarLayers() {
	return { body, eyes }
}
