import { resolveDeviceArtwork } from '../../device-art/catalog.js';
import { taskNeedsDetails, taskResultStatus } from '../tasks/task-presentation.mjs';
import { creatorVariant } from './region-device-view.mjs';

export function regionTimelineItems(tasks) {
  const records = new Map();
  for (const task of tasks) {
    const previous = records.get(task.id);
    if (!previous || (task.version ?? 0) >= (previous.version ?? 0)) records.set(task.id, task);
  }
  return [...records.values()]
    .filter((task) => task.status !== 'cancelled')
    .map((task) => {
      // 来源 draft/conversation id 只对创建者本人返回，等价于“我创建的任务”身份信号。
      const mine = Boolean(task.source?.draftId || task.source?.conversationId);
      const devices = task.devices || [];
      const creatorName = task.creator?.displayName || '';
      return {
        ...task,
        label: task.label || (task.occurrence?.virtual || task.repeat ? '周期任务' : '任务安排'),
        at: task.interval?.startsAt ?? task.phases?.[0]?.at,
        endAt:
          task.interval?.endsAt ?? (task.phases?.length > 1 ? task.phases.at(-1).at : undefined),
        faded: taskResultStatus(task) === 'verified' || task.status === 'cancelled',
        warning: taskNeedsDetails(taskResultStatus(task)),
        failure: false,
        avatars: devices.slice(0, 3).map((device) => ({
          id: device.id,
          src: resolveDeviceArtwork({ ...device, deviceName: device.name }).src,
        })),
        more: Math.max(0, devices.length - 3),
        creatorName,
        creatorMark: mine ? '我' : creatorName.slice(0, 1) || '?',
        creatorVariant: creatorVariant(creatorName, mine),
      };
    });
}
