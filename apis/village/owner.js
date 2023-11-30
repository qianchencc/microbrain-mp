import request from '../request'

// 业主确权新增
export const ownerRegister = (data) => request.globalRequest('/village/owner/house/register/owner/register', 'POST', data)

// 关联人员(常驻、家庭、租户)
export const fetchOtherMember = (params) => request.globalRequest('/village/owner/house/self/member', 'GET', params)

// 关联房产
export const fecthSelfHouse = () => request.globalRequest('/village/owner/house/self', 'POST')

// 我是业主确权列表
export const fecthOwnerRegisterList = () => request.globalRequest('/village/owner/house/register/my/owner/register/list', 'POST')

// 家庭成员新增
export const createOtherOwner = (data) => request.globalRequest('/village/owner/house/register/other/register', 'POST', data)

// 查询小区所在房产树
export const fecthHouseTree = () => request.globalRequest('/village/house/property/tree', 'GET')

// 我是租客确权列表
export const fecthTenantList = () => request.globalRequest('/village/owner/house/register/tenant/my/register/list', 'POST')

// 租客确权新增
export const createTenant = (data) => request.globalRequest('/village/owner/house/register/tenant/register', 'POST', data)

// 我的租客确权列表
export const fecthOwnerTenantList = () => request.globalRequest('/village/owner/house/register/my/tenant/register/list', 'POST')

// 审核确认
export const registerReview = (id, data) => request.globalRequest(`/village/owner/house/register/${id}/review`, 'PUT', data)

// 设置默认地址
export const setDefaultAddress = (id) => request.globalRequest(`/village/owner/house/${id}/default/address`, 'GET')

// ID查询确权信息
export const getOwnerRegisterByid = (id) => request.globalRequest(`/village/owner/house/register/${id}`, 'GET')

// 更新业主确权
export const updateOwnerRegister = (id, data) => request.globalRequest(`/village/owner/house/register/${id}`, 'PUT', data)

// 业主全信息
export const fetchOwnerAllInfo = (id) => request.globalRequest(`/village/owner/info/${id}/all/info`, 'GET')

// 用户是否业主
export const fetchOwnerCheck = (principalId, isOwner) => request.globalRequest(`/village/owner/house/check/${principalId}/${isOwner}`, 'GET')

// 房产Id查询房间信息
export const getRoomListById = (id) => request.globalRequest(`/village/house/property/list/children?id=${id}`)
