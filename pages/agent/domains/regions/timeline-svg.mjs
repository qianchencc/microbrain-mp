import { AGENT_COLORS } from '../../styles/colors.js'

export function timelineSvg(scene) {
 const pathData = commands => commands.map(command => command.join(' ')).join(' ')
 const paint = value => ['future', 'elapsed'].includes(value) ? `url(#${value})` : value || 'none'
 const defs = `<linearGradient id="future" gradientUnits="userSpaceOnUse" x1="46" x2="74"><stop stop-color="${AGENT_COLORS.chart}"/><stop offset="1" stop-color="${AGENT_COLORS.tint}"/></linearGradient><linearGradient id="elapsed" gradientUnits="userSpaceOnUse" x1="46" x2="74"><stop stop-color="${AGENT_COLORS.accentDeep}"/><stop offset="1" stop-color="${AGENT_COLORS.accent}"/></linearGradient>`
 let clips = ''
 const body = scene.shapes.map((shape, index) => {
  let attrs = `fill="${paint(shape.fill)}" stroke="${shape.stroke || 'none'}" stroke-width="${shape.lineWidth || 0}" stroke-linecap="round" opacity="${shape.opacity ?? 1}"`
  if (shape.dash) attrs += ` stroke-dasharray="${shape.dash.join(' ')}"`
  if (shape.clipY !== undefined) { clips += `<clipPath id="c${index}"><rect width="${scene.width}" height="${shape.clipY}"/></clipPath>`; attrs += ` clip-path="url(#c${index})"` }
  if (shape.type === 'path') return `<path d="${pathData(shape.commands)}" ${attrs}/>`
  if (shape.type === 'circle') return `<circle cx="${shape.x}" cy="${shape.y}" r="${shape.r}" ${attrs}/>`
  return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.r}" ${attrs}/>`
 }).join('')
 return `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs>${defs}${clips}</defs>${body}</svg>`
}
