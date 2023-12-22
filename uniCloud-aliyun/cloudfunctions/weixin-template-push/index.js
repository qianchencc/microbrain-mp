'use strict';
// 引入uni-subscribemsg公共模块
const UniSubscribemsg = require('uni-subscribemsg');
// 初始化实例
let uniSubscribemsg = new UniSubscribemsg({
	dcloudAppid: "__UNI__BDDC19C",
	provider: "weixin-h5", // 注意，这里是weixin-h5
});
exports.main = async (event, context) => {

	// 发送模板消息
	return await uniSubscribemsg.sendTemplateMessage({
		touser: "oiSqO602XfqfqhclCy_aIqLNF7wQ",
		template_id: "oOzSnRKefl2FRD9B0wGbyPzZw4N7n5M385GBBRBBD6Q",
		// url: "https://uniapp.dcloud.net.cn", // 用户点击消息后跳转的链接地址
		"miniprogram": {
			"appid": "wxef48157d70d2b50c",
			"pagepath": "pages/messages/index"
		},
		data: {
			leadername: {
				value: "李卫国",
				color: "#666666"
			},
			number: {
				value: "3",
				color: "#666666"
			}
		}
	});

};