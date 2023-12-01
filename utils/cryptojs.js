import CryptoJS from 'crypto-js'
const key = CryptoJS.enc.Utf8.parse("T#s)STq~whp]b52G"); //十六位十六进制数作为秘钥
const iv = CryptoJS.enc.Utf8.parse('Yw*M3^6JpV%0U@qk'); //十六位十六进制数作为秘钥偏移量
//解密方法
export function aesDecrypt(word) {
	const encryptedHexStr = CryptoJS.enc.Hex.parse(word);
	const srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
	const decrypt = CryptoJS.AES.decrypt(srcs, key);
	const decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
	return decryptedStr.toString();
}

//加密方法
export const aesEncrypt = (word) => {
	let srcs = CryptoJS.enc.Utf8.parse(word)
	let encrypted = CryptoJS.AES.encrypt(srcs, key, {
		iv: iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7
	})
	return encrypted.toString()
}