export const messagesType = {
	publish: {
		key: 'publish',
		src: '../../static/images/messages/notify.png',
		name: '公告消息'
	},
	meeting: {
		key: 'meeting',
		src: '../../static/images/messages/notify.png',
		name: '会议消息'
	},
	IN_SITE_MESSAGE: {
		key: 'visitor',
		src: '../../static/images/messages/notify.png',
		name: '访客消息'
	},
	patrol: {
		key: 'patrol',
		src: '../../static/images/messages/notify.png',
		name: '巡更消息'
	},
	service: {
		key: 'service',
		src: '../../static/images/messages/notify.png',
		name: '其他消息'
	},
	perception: {
		key: 'perception',
		src: '../../static/images/messages/warning.png',
		name: '报警消息'
	},
	space: {
		key: 'space',
		src: '../../static/images/messages/warning.png',
		name: '空间消息'
	},
	fire: {
		key: 'fire',
		src: '../../static/images/messages/warning.png',
		name: '消防消息'
	},
	vehicle: {
		key: 'vehicle',
		src: '../../static/images/messages/warning.png',
		name: '公车消息'
	},
	contradiction: {
		key: 'contradiction',
		src: '../../static/images/messages/warning.png',
		name: '矛调消息'
	},
	Contract: {
		key: 'Contract',
		src: '../../static/images/messages/warning.png',
		name: '合同消息'
	},
	property: {
		key: 'property',
		src: '../../static/images/messages/warning.png',
		name: '资产消息'
	},
	loveMend: {
		key: 'loveMend',
		src: '../../static/images/messages/warning.png',
		name: '爱心缝补房'
	},
	institution: {
		key: 'institution',
		src: '../../static/images/messages/warning.png',
		name: '机构入驻'
	},
	expert: {
		key: 'expert',
		src: '../../static/images/messages/warning.png',
		name: '达人中心'
	},
	fleaMarket: {
		key: 'fleaMarket',
		src: '../../static/images/messages/warning.png',
		name: '跳蚤市场'
	},
	eventCenter: {
		key: 'eventCenter',
		src: '../../static/images/messages/warning.png',
		name: '事件中心'
	},
	workorder: {
		key: 'workorder', // 对应子系统域名
		src: '../../static/images/messages/notify.png',
		name: '工单消息',
		target: '/pages/user/workorder/detail', // 消息跳转详情路径
		options: ['title=详情'] // 跳转子页面特殊参数
	},
	workorderhandle: {
		key: 'workorder', // 对应子系统域名
		src: '../../static/images/messages/notify.png',
		name: '工单消息',
		target: '/pages/government/user/workorder/detail', // 消息跳转详情路径
		options: ['title=详情'] // 跳转子页面特殊参数
	},
	owner: {
		key: 'owner',
		src: '../../static/images/messages/notify.png',
		name: '业主消息',
		page: true, // 是否内部页面跳转
		target: '/pages/user/owner',
	},
	decoration: {
		key: 'decoration',
		src: '../../static/images/messages/notify.png',
		name: '装修消息',
		target: '',
	},
	payment: {
		key: 'payOnline',
		src: '../../static/images/messages/notify.png',
		name: '缴费消息',
		target: '',
	}
}