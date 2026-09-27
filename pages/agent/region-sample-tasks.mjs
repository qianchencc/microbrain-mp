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
