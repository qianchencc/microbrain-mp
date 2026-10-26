import { resolveDeviceArtwork } from './device-art/catalog.js'
import { taskNeedsDetails, taskResultStatus } from './task-presentation.mjs'
import { creatorVariant } from './region-device-view.mjs'

export function regionTimelineItems(tasks) {
 return tasks.filter(task => task.status !== 'cancelled').map(task => {
  // 来源 draft/conversation id 只对创建者本人返回，等价于“我创建的任务”身份信号。
  const mine = Boolean(task.source?.draftId || task.source?.conversationId)
  return {
   ...task, at: task.interval?.startsAt ?? task.phases[0].at,
   endAt: task.interval?.endsAt ?? (task.phases.length > 1 ? task.phases.at(-1).at : undefined),
   faded: taskResultStatus(task) === 'verified' || task.status === 'cancelled',
   warning: taskNeedsDetails(taskResultStatus(task)), failure: false,
   avatars: task.devices.slice(0, 3).map(device => ({ id: device.id, src: resolveDeviceArtwork({ ...device, deviceName: device.name }).src })),
   more: Math.max(0, task.devices.length - 3), creatorName: task.creator.displayName,
   creatorMark: mine ? '我' : task.creator.displayName.slice(0, 1), creatorVariant: creatorVariant(task.creator.displayName, mine),
  }
 })
}
