import AES from 'crypto-js/aes'
import Utf8 from 'crypto-js/enc-utf8'
import Hex from 'crypto-js/enc-hex'
import Base64 from 'crypto-js/enc-base64'
import Pkcs7 from 'crypto-js/pad-pkcs7'
const key = Utf8.parse("T#s)STq~whp]b52G"); //十六位十六进制数作为秘钥
const iv = Utf8.parse('Yw*M3^6JpV%0U@qk'); //十六位十六进制数作为秘钥偏移量
//解密方法
export function aesDecrypt(word) {
	const encryptedHexStr = Hex.parse(word);
	const srcs = Base64.stringify(encryptedHexStr);
	const decrypt = AES.decrypt(srcs, key);
	const decryptedStr = decrypt.toString(Utf8);
	return decryptedStr.toString();
}

//加密方法
export const aesEncrypt = (word) => {
	let srcs = Utf8.parse(word)
	let encrypted = AES.encrypt(srcs, key, {
		iv: iv,
		padding: Pkcs7
	})
	return encrypted.toString()
}
