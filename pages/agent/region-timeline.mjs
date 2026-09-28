import { resolveDeviceArtwork } from './device-art/catalog.js'
import { creatorVariant } from './region-device-view.mjs'

export function regionTimelineItems(tasks) {
 return tasks.map(task => {
  // 来源 draft/conversation id 只对创建者本人返回，等价于“我创建的任务”身份信号。
  const mine = Boolean(task.source?.draftId || task.source?.conversationId)
  return {
   ...task, at: task.phases[0].at, endAt: task.phases.length > 1 ? task.phases.at(-1).at : undefined,
   faded: task.status === 'completed' || task.status === 'cancelled',
   warning: task.status === 'partial', failure: ['failed', 'missed', 'interrupted'].includes(task.status),
   avatars: task.devices.slice(0, 3).map(device => ({ id: device.id, src: resolveDeviceArtwork({ ...device, deviceName: device.name }).src })),
   more: Math.max(0, task.devices.length - 3), creatorName: task.creator.displayName,
   creatorMark: mine ? '我' : task.creator.displayName.slice(0, 1), creatorVariant: creatorVariant(task.creator.displayName, mine),
  }
 })
}
