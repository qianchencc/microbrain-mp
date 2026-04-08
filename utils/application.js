import {getOtherTicket} from "@/apis/user/menu";
import {webJump} from "@/utils/tools";

const toOtherApp = async (menu) => {
	const [type, url] = menu.uri.split(':=:')
	let res = await getOtherTicket()
	if (!res) return;
	webJump(`${url}&ticket=${res}&noToken=true`)
}

export const menuFuc = async (name, menu) => {
	switch (name) {
		case 'toOtherApp':
			toOtherApp(menu)
			break;
		default:
			break;
	}
}
