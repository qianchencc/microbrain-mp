'use strict';

exports.main = async (event, context) => {
	// event里包含着客户端提交的参数
	const res = await uniCloud.getPhoneNumber({
		appid: context.APPID, // 替换成自己开通一键登录的应用的DCloud appid
		provider: 'univerify',
		access_token: event.access_token,
		openid: event.openid
	})
	return res
}