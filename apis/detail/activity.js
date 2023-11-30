// import Request from './request.js'

// const request = new Request('/api/futurecommunity')

import request from '../request'

export const statusObj = [{
		value: 'SIGNING_UP',
		label: '报名中',
		class: 'success'
	},
	{
		value: 'NOT_START',
		label: '未开始',
		class: ''
	},
	{
		value: 'ONGOING',
		label: '进行中',
		class: 'wait'
	},
	{
		value: 'FINISHED',
		label: '已结束',
		class: 'cancel'
	}
];

export const examineObj = [{
		value: 'REVIEWED',
		label: '已审核',
		class: 'success'
	},
	{
		value: 'TO_BE_REVIEWED',
		label: '未审核',
		class: ''
	}
];

export const applyObj = [{
		value: 'TO_BE_REVIEWED',
		label: '待审核'
	},
	{
		value: 'PASS',
		label: '通过',
		class: 'success'
	},
	{
		value: 'REJECT',
		label: '驳回',
		class: 'fail'
	}
];

export const dealKey = (val, type) => {
	console.log('dealkey ====>', val, type)
	switch (type) {
		case 'status':
			return val ? statusObj.find(item => item.value === val) : {}
		case 'examine':
			return val ? examineObj.find(item => item.value === val) : {}
		case 'apply':
			console.log('applyObj ===>', val ? applyObj.find(item => item.value === val) : {})
			return val ? applyObj.find(item => item.value === val) : {}
		case 'push':
			console.log('pushObj ===>', val ? pushObj.find(item => item.value === val) : {})
			return val ? pushObj.find(item => item.value === val) : {}
		default:
			return {}
	}
	// return val ? statusObj.find(item => item.value === val) : {}
};

// 获取活动类型
// export const getActivityType = () => request.get('/backend/activity/type/list')
export const getActivityType = () => request.globalRequest('/futurecommunity/backend/activity/type/list', 'GET')

// 获取活动分页
// export const getActivityPage = data => request.get('/mini/activityCenter/page', data)
export const getActivityPage = data => request.globalRequest('/futurecommunity/mini/activityCenter/page', 'GET', data)

// 活动详情
// export const getActivityDetail = data => request.get('/mini/activityCenter/detail', data)
export const getActivityDetail = data => request.globalRequest('/futurecommunity/mini/activityCenter/detail', 'GET', data)
export const getActivityDetailForPyq = data => request.globalRequest('/futurecommunity/mini/activityCenter/detailForPyq', 'GET', data)

// 关注
// export const collectActivity = data => request.post('/mini/activityCenter/focus', data, true)
export const collectActivity = data => request.globalRequest('/futurecommunity/mini/activityCenter/focus', 'POST', data,
	true)

// 取消关注
// export const cancelCollect = date => request.delete('/mini/activityCenter/cancelFocus', date)
export const cancelCollect = date => request.globalRequest('/futurecommunity/mini/activityCenter/cancelFocus', 'DELETE',
	date, true)

// 报名
// export const applyActivity = data => request.post('/mini/activityCenter/signup', data)
export const applyActivity = data => request.globalRequest('/futurecommunity/mini/activityCenter/signup', 'POST', data)

// 取消报名
// export const cancelApply = data => request.delete('/mini/activityCenter/cancelSignup', data)
export const cancelApply = data => request.globalRequest('/futurecommunity/mini/activityCenter/cancelSignup', 'DELETE',
	data, true)

// 征集投票报名详情
// export const getMyVoteApplyDetail = data => request.get('/mini/activityCenter/detail/signUp', data)
export const getMyVoteApplyDetail = data => request.globalRequest('/futurecommunity/mini/activityCenter/detail/signUp',
	'GET', data)

// 修改投票征集报名
// export const editVoteApply = data => request.put('/mini/activityCenter/reSubmitSignUp', data, true)
export const editVoteApply = data => request.globalRequest('/futurecommunity/mini/activityCenter/reSubmitSignUp', 'PUT',
	data, true)

// 签到
// export const signIn = data => request.post('/mini/activityCenter/signIn', data)
export const signIn = data => request.globalRequest('/futurecommunity/mini/activityCenter/signIn', 'POST', data)

// 签退
// export const signOut = data => request.post('/mini/activityCenter/signOut', data)
export const signOut = data => request.globalRequest('/futurecommunity/mini/activityCenter/signOut', 'POST', data)

// 判断是否是居民
// export const jundeUser = () => request.get('/mini/activityCenter/isResident')
export const jundeUser = () => request.globalRequest('/futurecommunity/mini/activityCenter/isResident', 'GET')

export const pushObj = [{
		value: 'TO_BE_REVIEWED',
		label: '待审核'
	},
	{
		value: 'REJECTED',
		label: '未通过',
		class: 'fail'
	},
	{
		value: 'HELPING',
		label: '助力中',
		class: 'success'
	},
	{
		value: 'HELPING_FAIL',
		label: '助力失败',
		class: 'fail'
	},
	{
		value: 'SIGNING_UP',
		label: '报名中',
		class: 'success'
	},
	{
		value: 'ONGOING',
		label: '进行中',
		class: 'wait'
	},
	{
		value: 'NOT_START',
		label: '未开始'
	},
	{
		value: 'FINISHED',
		label: '已结束',
		class: 'cancel'
	}
]

// // 我发起的活动列表
// export const getMyPushActivityPage = data => request.get('/mini/activityCenter/page/mySubmit', data)

// // 提交活动
// export const pushMyActivity = data => request.post('/mini/activityCenter', data)

// // 修改
// export const editMyPushActivity = data => request.put('/mini/activityCenter/mySubmit', data)

// // 修改活动详情
// export const getMyPushEditDetail = data => request.get('/mini/activityCenter/updateDetail/mySubmit', data)

// // 我发起的活动详情
// export const myPushDetail = data => request.get('/mini/activityCenter/detail/mySubmit', data)

// // 取消活动
// export const cancelMyActivity = data => request.put('/mini/activityCenter/mySubmit/cancel', data, true)

// // 完善活动
// export const completeActivity = data => request.put('/mini/activityCenter/mySubmit/complete', data)

// // 发布活动
// export const pushMyCompleteActivity = data => request.put('/mini/activityCenter/mySubmit/publish', data, true)

// // 查询助力详情
// export const getHelpDetail = data => request.get('/mini/activityCenter/detail/help', data)

// // 助力活动
// export const helpActivity = data => request.put('/mini/activityCenter/help', data, true)