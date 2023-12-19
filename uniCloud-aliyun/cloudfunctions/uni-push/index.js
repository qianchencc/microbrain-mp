// 简单的使用示例
'use strict';
const uniPush = uniCloud.getPushManager({ appId: "__UNI__BDDC19C" }) //注意这里需要传入你的应用appId，用于指定接收消息的客户端
exports.main = async (event, context) => {
	// console.log(11111, event.a);

	return await uniPush.sendMessage({
		// "user_id": '658065e499c62431df3bfc30',
		"push_clientid": "d4b41864b3f9a09cda0cdca5397dd19b", //填写上一步在uni-app客户端获取到的客户端推送标识push_clientid
		"title": "通知栏显示的标题",
		"content": 'event.a',
		"payload": {
			"text": "体验一下uni-push2.0"
		},
		"force_notification": true
	})
};