import {useUserStoreHook} from "../store/modules/user";
import {fetchApplicationDistributionCode, getJztMsg, getZztMsg} from "../apis/user/principal";
import {zztCode, zztServer} from "../config/settings";

// 浙住通方法
const toZzt = async menu => {
	let userInfo = useUserStoreHook().getUserInfo
	let url = `${zztServer}/#/pages/indexXcx/indexXcx`
	let res = await getZztMsg()
	if (!res) return
	let { loginId, openId } = res.content
	let otherQuery = `fcbm=${zztCode}&telephone=${userInfo.mobile}&loginId=${loginId}&openid=${openId}&noToken=true`
	// #ifdef MP-WEIXIN
	uni.navigateTo({
		url: `/pages/webView/index?path=${url}&${otherQuery}`
	})
	// #endif
	// #ifdef H5
	location.href = `${url}?${otherQuery}`
	// #endif
}

// 家头条方法
const toJtt = async menu => {
	let res = await getJztMsg()
	if (!res) return
	// #ifdef MP-WEIXIN
	let url = `https://jtt.tmuyun.com/zhejiang_jtt_wswlsq/#/home&code=${res.content}&from=330303001011&state=SUCCESS&noToken=true`
	uni.navigateTo({
		url: `/pages/webView/index?path=${url}`
	})
	// #endif
	// #ifdef H5
	let url = `https://jtt.tmuyun.com/zhejiang_jtt_wswlsq/#/home?code=${res.content}&from=330303001011&state=SUCCESS`
	location.href = url
	// #endif
}

// 三方应用方法(按照他们说的是有很多,但目前只有社群使用了这个方法)
const applyOnFuc = async menu => {
	let res = await fetchApplicationDistributionCode({
		id: menu.id
	})
	if (!res) return
	console.log('fetchApplicationDistributionCode =====>', res)
	// res = JSON.parse(res)
	const authCode = `${res.content}_%23${zztCode}`
	if (menu.uri.startsWith('http')) {
		uni.navigateTo({
			url: `/pages/webView/index?path=${menu.uri}&getCode=true&authCode=${authCode}&noToken=true`
		})
	} else if (menu.uri.startsWith('wxProgram')) {
		wx.navigateToMiniProgram({
			shortLink: menu.uri.replace('wxProgram', '#小程序')
		})
	}
}

// 小程序短链接, 防止和三方短链接混淆
const shortMiniJump = menu => {
	wx.navigateToMiniProgram({
		shortLink: menu.uri.replace('wxProgram', '#小程序')
	})
}

// 应用暂未接入
const noJoin = menu => {
	uni.showToast({
		title: `${menu.title}应用接入中`,
		icon: 'none'
	})
}

export const menuFuc = {
	// applyOnFuc
	satisfaction: applyOnFuc,
	// shortMiniJump
	medicalInsurance: shortMiniJump,
	healthHere: shortMiniJump,
	settleDown: shortMiniJump,
	passImpeded: shortMiniJump,
	myHome: shortMiniJump,
	bazaar: shortMiniJump,
	study: shortMiniJump,
	public: shortMiniJump,
	fitness: shortMiniJump,
	together: shortMiniJump,
	veteran: shortMiniJump,
	zlHelp: shortMiniJump,
	science: shortMiniJump,
	salvation: shortMiniJump,
	orderDoctor: shortMiniJump,
	elderSchool: shortMiniJump,
	medicalAdd: shortMiniJump,
	socialSecurityQuery: shortMiniJump,
	wzMerry: shortMiniJump,
	birthRegister: shortMiniJump,
	birthMoneyGet: shortMiniJump,
	childInSchool: shortMiniJump,
	// 三方
	zzt: toZzt
};
