export function storageSet(key, value) {
	try {
		uni.setStorageSync(key, JSON.stringify(value));
	} catch (e) {
		// error
	}
}

export function storageGet(key) {
	const value = uni.getStorageSync(key)
	try {
		return JSON.parse(value)
	} catch (error) {
		return value
	}
}

export function storageRemove(key){
	try {
		uni.removeStorageSync(key);
	} catch (e) {
		// error
	}
}
