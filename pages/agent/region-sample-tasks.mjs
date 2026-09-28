// Local workbench preview data. Task IDs are never persisted or executable.
export function regionSampleTasks(date, regionId, devices) {
 const at = time => `${date}T${time}:00+08:00`
 const lights = devices.filter(device => device.kind === 'lighting').slice(0, 4)
 const ac = devices.find(device => device.kind === 'ac')
 const action = (device, target, outcome) => ({ id: device.id, kind: device.kind, name: device.name, target, outcome })
 const phase = (id, time, status, actions) => ({ id: `sample-phase-${id}`, at: at(time), status, devices: actions })
 const task = (id, label, status, creatorName, phases) => ({
  id: `sample-${id}`, label, status, version: 1, regionIds: [regionId], createdAt: at('07:00'), phases,
  devices: [...new Map(phases.flatMap(item => item.devices).map(device => [device.id, {
   id: device.id, kind: device.kind, name: device.name, outcome: device.outcome,
  }])).values()],
  creator: { displayName: creatorName }, source: { type: 'sample' }, canCancel: false,
 })
 const tasks = []
 if (ac) tasks.push(task('morning-ac', '晨间准备', 'completed', '张明', [
  phase('morning-ac', '08:30', 'verified', [action(ac, { power: 'on', temperature: 26 }, 'verified')]),
 ]))
 if (lights.length > 1) tasks.push(task('noon-light', '午间照明调整', 'partial', '系统', [
  phase('noon-light', '12:00', 'partial', lights.slice(0, 2).map((device, index) =>
   action(device, { closeOrOpen: 1 }, index ? 'rejected' : 'verified'))),
 ]))
 if (ac && lights.length) {
  const meeting = [...lights.slice(0, 2), ac]
  tasks.push(task('meeting-window', '客户会议 · 会议室B', 'executing', '李雯', [
   phase('meeting-start', '14:00', 'verified', meeting.map((device, index) =>
    action(device, device.kind === 'ac' ? { power: 'on', temperature: 26 } : { closeOrOpen: 1 }, index ? 'verified' : 'satisfied'))),
   phase('meeting-end', '15:30', 'pending', meeting.map(device =>
    action(device, device.kind === 'ac' ? { power: 'off' } : { closeOrOpen: 0 }, 'pending'))),
  ]))
 }
 if (lights.length) {
  tasks.push(task('after-hours', '下班关灯', 'scheduled', '张明', [
   phase('after-hours', '19:00', 'pending', lights.map(device => action(device, { closeOrOpen: 0 }, 'pending'))),
  ]))
  tasks.push(task('cleaning', '晚间保洁照明', 'scheduled', '王工', [
   phase('cleaning-start', '20:00', 'pending', lights.slice(0, 3).map(device => action(device, { closeOrOpen: 1 }, 'pending'))),
   phase('cleaning-end', '21:30', 'pending', lights.slice(0, 3).map(device => action(device, { closeOrOpen: 0 }, 'pending'))),
  ]))
 }
 return tasks
}

export function regionSampleTaskDetail(task) {
 if (!task) return null
 return { ...task, phases: task.phases.map(phase => ({ ...phase,
  devices: phase.devices.map(device => ({ ...device, details: null })) })) }
}

export function deviceSampleEvents(tasks, deviceId) {
 return tasks.flatMap(task => task.phases.flatMap(phase => phase.devices
  .filter(device => device.id === deviceId)
  .map(device => ({ taskId: task.id, taskLabel: task.label, taskStatus: task.status,
   sourceType: 'sample', creatorName: task.creator.displayName, phaseId: phase.id, phaseStatus: phase.status,
   at: phase.at, device, target: device.target, outcome: device.outcome }))))
}
