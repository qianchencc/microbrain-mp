import { resolveDeviceArtwork } from './device-art/catalog.js'

export function regionTimelineItems(tasks) {
 return tasks.map(task => {
  const uncertain = task.devices.some(device => ['unconfirmed', 'unknown'].includes(device.outcome))
  const failed = task.devices.some(device => ['rejected', 'missing', 'unreadable', 'not_dispatched'].includes(device.outcome))
  return {
   ...task, at: task.phases[0].at, endAt: task.phases.length > 1 ? task.phases.at(-1).at : undefined,
   faded: task.status === 'completed',
   statusText: task.status === 'completed' ? '已完成' : task.status === 'partial' ? '部分完成' : uncertain && !failed ? '待核验' : '未完成',
   avatars: task.devices.slice(0, 3).map(device => ({ id: device.id, src: resolveDeviceArtwork({ ...device, deviceName: device.name }).src })),
   more: Math.max(0, task.devices.length - 3), creatorName: task.creator.displayName,
  }
 })
}
