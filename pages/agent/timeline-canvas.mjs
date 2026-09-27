export function drawTimeline(context, scene) {
 context.clearRect(0, 0, scene.width, scene.height)
 const paint = fill => {
  if (!['future', 'elapsed'].includes(fill)) return fill
  const gradient = context.createLinearGradient(46, 0, 74, 0)
  gradient.addColorStop(0, fill === 'future' ? '#b4d3c1' : '#126448')
  gradient.addColorStop(1, fill === 'future' ? '#d9e9dd' : '#258767')
  return gradient
 }
 scene.shapes.forEach(shape => {
  context.save()
  if (shape.clipY !== undefined) { context.beginPath(); context.rect(0, 0, scene.width, shape.clipY); context.clip() }
  context.globalAlpha = shape.opacity ?? 1
  context.beginPath()
  if (shape.type === 'path') shape.commands.forEach(([op, ...args]) => {
   if (op === 'M') context.moveTo(...args)
   else if (op === 'L') context.lineTo(...args)
   else if (op === 'C') context.bezierCurveTo(...args)
   else context.closePath()
  })
  else if (shape.type === 'circle') context.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2)
  else {
   const { x, y, w, h, r } = shape
   context.moveTo(x + r, y); context.lineTo(x + w - r, y); context.quadraticCurveTo(x + w, y, x + w, y + r)
   context.lineTo(x + w, y + h - r); context.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
   context.lineTo(x + r, y + h); context.quadraticCurveTo(x, y + h, x, y + h - r)
   context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y)
  }
  if (shape.fill) { context.fillStyle = paint(shape.fill); context.fill() }
  if (shape.stroke) { context.strokeStyle = shape.stroke; context.lineWidth = shape.lineWidth; context.lineCap = 'round'; context.setLineDash(shape.dash || []); context.stroke() }
  context.restore()
 })
}
