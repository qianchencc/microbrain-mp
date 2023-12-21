// 简单的使用示例
'use strict';
const uniPush = uniCloud.getPushManager({ appId: "__UNI__BDDC19C" }) //注意这里需要传入你的应用appId，用于指定接收消息的客户端
exports.main = async (event, context) => {
	let source = context.SOURCE
	let data = event
	if (source === 'http') {
		data = JSON.parse(event.body)
	} //force_notification
	return await uniPush.sendMessage(data)
};