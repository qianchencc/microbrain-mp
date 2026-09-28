// Local workbench preview data. IDs cannot be confused with persisted Task IDs.
export function regionSampleTasks(date, regionId) {
 const at = time => `${date}T${time}:00+08:00`
 const device = (id, kind, name, outcome) => ({ id: `sample-${id}`, kind, name, outcome })
 const task = (id, label, time, status, devices, creatorName = '演示成员') => ({
  id: `sample-${id}`, label, status, version: 1, regionIds: [regionId],
  phases: [{ id: `sample-phase-${id}`, at: at(time), status }],
  devices, creator: { displayName: creatorName },
  source: { type: 'sample' }, canCancel: false,
 })
 return [
  { ...task('meeting-window', '客户会议 · 会议室B', '14:00', 'executing', [device('ac-window', 'ac', '会议室空调', 'verified')]),
   phases: [
    { id: 'sample-phase-window-start', at: at('14:00'), status: 'verified', devices: [{ ...device('ac-window', 'ac', '会议室空调', 'verified'), target: { power: 'on', temperature: 26 } }] },
    { id: 'sample-phase-window-end', at: at('15:30'), status: 'pending', devices: [{ ...device('ac-window', 'ac', '会议室空调', 'pending'), target: { power: 'off' } }] },
   ] },
  task('morning-ac', '晨间空调开启', '08:30', 'completed', [
   device('ac-east', 'ac', '东区空调', 'verified'), device('ac-west', 'ac', '西区空调', 'satisfied'),
  ]),
  task('meeting-light', '会议室照明开启', '10:05', 'completed', [
   device('light-meeting', 'lighting', '会议室格栅灯', 'verified'), device('strip-meeting', 'lighting', '会议室灯带', 'verified'),
  ]),
  task('noon-light', '午间照明调整', '11:50', 'partial', [
   device('light-east', 'lighting', '东区格栅灯', 'verified'), device('light-west', 'lighting', '西区格栅灯', 'rejected'),
  ]),
  task('ac-temperature', '会议室空调调温', '13:15', 'failed', [
   device('ac-meeting', 'ac', '会议室空调', 'rejected'),
  ]),
  task('corridor-light', '走廊照明开启', '14:05', 'completed', [
   device('strip-corridor', 'lighting', '走廊灯带', 'verified'),
  ]),
  task('readback', '办公区照明关闭', '14:35', 'failed', [
   device('light-office', 'lighting', '办公区格栅灯', 'unconfirmed'),
  ]),
 ]
}

export function regionSampleTaskDetail(task) {
 const target = task.label.includes('关闭') ? { power: 'off' } : task.label.includes('调温') ? { temperature: 26 } : { power: 'on' }
 return { ...task, createdAt: task.phases[0].at, phases: task.phases.map(phase => ({ ...phase,
  devices: (phase.devices || task.devices.map(device => ({ ...device, target }))).map(device => ({ ...device, details: null })) })) }
}

export function deviceSampleTask(device, date) {
 if (!['lighting', 'ac'].includes(device.kind)) return null
 const at = time => `${date}T${time}:00+08:00`
 const id = `sample-device-${device.id}`
 const phase = (suffix, time, target) => ({ id: `${id}-${suffix}`, at: at(time), status: 'verified',
  devices: [{ id: device.id, kind: device.kind, name: device.name, target, outcome: 'verified', details: null }] })
 const phases = device.kind === 'ac'
  ? [phase('start', '09:00', { power: 'on', temperature: 26 }), phase('end', '14:00', { power: 'off' })]
  : [phase('point', '10:30', { closeOrOpen: 1 })]
 return { id, label: device.kind === 'ac' ? '空调时段演示' : '照明操作演示', status: 'completed',
  createdAt: phases[0].at, creator: { displayName: '演示成员' }, source: { type: 'sample' }, phases }
}
