'use strict';
const UniSubscribemsg = require('uni-subscribemsg');
let uniSubscribemsg = new UniSubscribemsg({
	dcloudAppid: "__UNI__BDDC19C",
	provider: "weixin-mp",
});
exports.main = async (event, context) => {
	let source = context.SOURCE
	let data = event
	if (source === 'http') {
		data = JSON.parse(event.body)
	}
	// 发送订阅消息
	return await uniSubscribemsg.sendSubscribeMessage(data)
};