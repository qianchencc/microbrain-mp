import request from './api.js'

// 门禁-区域列表（楼层/房间）
export const fetchAccessAreaList = parentId => request.globalRequest(`/api/office/app/device/access/myAreaList`, 'GET', { parentId })

// 门禁-设备列表
export const fetchAccessDeviceList = areaFullCode => request.globalRequest(`/api/office/app/device/access/devicePage`, 'GET', { areaFullCode })

// 门禁-开锁 controlType: 2(固定值)
export const openAccessDevice = data => request.globalRequest(`/api/office/app/device/access/down`, 'POST', data)