import { storageGet } from './storage'
const dictList = storageGet('dict')

// 根据key获取数据字典
export function getDictItem(dictName) {
	try {
		let array = []
		const dictItem = dictList[dictName]
		for (let key in dictItem) {
			array.push({value: key, text: dictItem[key]})
		}
		return array
	} catch (error) {
		return []
	}
}

// 根据key获取数据字典value值
export function getDictValue(dictName, key){
	try {
		return dictList[dictName][key]
	} catch (error) {
		return '11'
	}
}
