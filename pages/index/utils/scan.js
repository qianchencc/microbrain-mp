export const handleScan = () => {
	// #ifdef MP
	uni.scanCode({
		success: function(res) {
			try {
				const data = JSON.parse(res.result) || ''
				console.log(data);
				if (data.type === 'visitor') {
					if (false && new Date().getTime() - data.time > 60 * 1000) {
						uni.showToast({
							title: '刷新二维码重试',
							icon: 'none'
						});
					} else {
						uni.navigateTo({
							url: `/pages/webView/index?path=${SCHEME}${COOKIE_DOMAIN}${data.path}&id=${data.id}`,
							animationType: 'pop-in'
						})
					}
				}
			} catch (e) {
				//TODO handle the exception
				console.log(e)
			}
		}

	})
	// #endif
	// #ifdef H5
	uni.scanCode({
		success(res) {
			console.log(res);
		}
	})
	// #endif
}