import request from './api.js'

// 门禁-区域列表（楼层/房间）
export const fetchAccessAreaList = parentId => request.globalRequest(`/api/office/app/device/access/myAreaList`, 'GET', { parentId })

// 门禁-设备列表
export const fetchAccessDeviceList = areaFullCode => request.globalRequest(`/api/office/app/device/access/devicePage`, 'GET', { areaFullCode })

// 门禁-开锁 controlType: 2(固定值)
export const openAccessDevice = data => request.globalRequest(`/api/office/app/device/access/down`, 'POST', data)

// 照明-区域列表（楼层/房间）
export const fetchLightAreaList = parentId => request.globalRequest(`/api/office/app/device/lighting/myAreaList`, 'GET', { parentId })

// 照明-设备列表
export const fetchLightDeviceList = areaFullCode => request.globalRequest(`/api/office/app/device/lighting/devicePage`, 'GET', { areaFullCode })

// 照明-开关 closeOrOpen: 0关 1开（根据当前switchStatus取反）
export const switchLightDevice = data => request.globalRequest(`/api/office/app/device/lighting/down`, 'POST', data)

// 空调-区域列表（楼层/房间）
export const fetchAcAreaList = parentId => request.globalRequest(`/api/office/app/device/ac/myAreaList`, 'GET', { parentId })

// 空调-设备列表
export const fetchAcDeviceList = areaFullCode => request.globalRequest(`/api/office/app/device/ac/devicePage`, 'GET', { areaFullCode })

// 空调-开关 acDeviceParamTemplate: AC_OPEN开 AC_CLOSE关（根据当前switchStatus取反）
export const switchAcDevice = data => request.globalRequest(`/api/office/app/device/ac/down`, 'POST', data)