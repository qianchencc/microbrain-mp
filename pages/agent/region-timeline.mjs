import { resolveDeviceArtwork } from './device-art/catalog.js'

export function regionTimelineItems(tasks) {
 return tasks.map(task => ({
   ...task, at: task.phases[0].at, endAt: task.phases.length > 1 ? task.phases.at(-1).at : undefined,
   faded: task.status === 'completed' || task.status === 'cancelled',
   warning: task.status === 'partial', failure: ['failed', 'missed', 'interrupted'].includes(task.status),
   avatars: task.devices.slice(0, 3).map(device => ({ id: device.id, src: resolveDeviceArtwork({ ...device, deviceName: device.name }).src })),
   more: Math.max(0, task.devices.length - 3), creatorName: task.creator.displayName,
 }))
}
