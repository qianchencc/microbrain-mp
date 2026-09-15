import 'text-encoding-utf-8/src/polyfill.js'
import { _posed } from 'blobatar/internal'

function source(marks) {
 const drawing = marks.map(mark => mark.kind === 'path'
  ? `<path d="${mark.d}" fill="${mark.fill}"/>`
  : `<circle cx="${mark.cx}" cy="${mark.cy}" r="${mark.r}" fill="${mark.fill}"/>`).join('')
 return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${drawing}</svg>`)
}

export function avatarLayers(conversationId) {
 const drawing = _posed(`agent:${conversationId}`, {background:false})
 return {body:source(drawing.marks),eyes:source(drawing.eyes)}
}
