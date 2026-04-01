const toOtherApp = async (menu) => {
	console.log(menu)
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
