//云函数wxLogin
'use strict';
const uniID = require("uni-id")
exports.main = async (event, context) => {
	const res = await uniID.loginByWeixin({
		code: event.code
	})
	return res
};
