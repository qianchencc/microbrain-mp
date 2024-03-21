let NfcA = null

export const initNfc = () => {
	const NFCAdapter = wx.getNFCAdapter()

	NFCAdapter.startDiscovery({
		success: (res) => {
			console.log('开启成功');
			console.log(res);
		},
		fail: (e) => {
			console.log('开启失败');
			console.log(e);
		}
	})

	NFCAdapter.onDiscovered((res) => {
		console.log('扫码成功');
		console.log(res);
		const cardId = res.id
		const id = ab2hex(cardId)
		console.log('cardId', id);
		uni.navigateTo({
		    url: '/pages/check/index?code=' + id,
		    animationType: 'pop-in'
		})
		
		// if (res.techs.includes('NFC-A')) {
		// 	initNfcA(NFCAdapter)
		// }
	})
}

const initNfcA = (NFCAdapter) => {
	NfcA = NFCAdapter.getNfcA()
	NfcA.connect({
		success: (res) => {
			console.log('连接成功');
			console.log(res);
			transceive('a001ffffffffffffffffffffffffffffffff')
		},
		fail: (e) => {
			console.log('连接失败');
			console.log(e);
		}
	})

	// NfcA.getAtqa({
	// 	success: (res) => {
	// 		console.log('Atqa成功');
	// 		console.log(res);
	// 		const atqa = ab2hex(res.atqa)
	// 		console.log('atqa', atqa);

	// 	},
	// 	fail: (e) => {
	// 		console.log('Atqa失败');
	// 		console.log(e);
	// 	}
	// })

	// NfcA.getSak({
	// 	success: (res) => {
	// 		console.log('sak成功');
	// 		console.log(res);
	// 		console.log('sak', res.sak);

	// 	},
	// 	fail: (e) => {
	// 		console.log('sak失败');
	// 		console.log(e);
	// 	}
	// })

	// const params = {
	// 	cmd: 0x60, // 验证指令
	// 	block: 0x02, // 块
	// 	cardId: [0x1d, 0xc1, 0x3f, 0xf1, 0x92], // 卡片id 获取从 NFCAdapter.onDiscovered((res)=>{ // res中含有卡片id });
	// 	key: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff], // 验证密钥
	// };
	// const str = '3001'
	// const arr = [params.cmd, params.block, ...params.cardId, ...params.key];
}

export function transceive(str) {
	NfcA.transceive({
		data: str2Buffer(str),
		success: function(res) {
			const data = ab2hex(res.data)
			console.log("解密成功, 接收数据如下:", data);
			uni.showModal({
				title: '扫码成功',
				content: data
			});
			// 开始读写
		},
		fail: function(err) {
			console.log("解密失败", err);
		},
	});
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
	const hexArr = Array.prototype.map.call(
		new Uint8Array(buffer),
		function(bit) {
			return ('00' + bit.toString(16)).slice(-2)
		}
	)
	return hexArr.join('')
}

function str2Buffer(str) {
	var pos = 0;
	str = str.replace(/\s*/g, "");
	var len = str.length;
	if (len % 2 != 0) {
		return null;
	}
	len /= 2;
	let buffer = new ArrayBuffer(len)
	let dataViewLast = new DataView(buffer)
	for (var i = 0; i < len; i++) {
		var s = str.substr(pos, 2);
		var v = parseInt(s, 16);
		dataViewLast.setUint8(i, v)
		pos += 2;
	}
	return dataViewLast.buffer;
}