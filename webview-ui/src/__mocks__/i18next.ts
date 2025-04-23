// Mock for i18next
const i18next = {
	use: function (plugin: any) {
		return this
	},
	init: function () {
		return this
	},
	t: function (key: string) {
		const parts = key.split(":")
		return parts.length > 1 ? parts[1] : key
	},
	changeLanguage: () => new Promise(() => {}),
	addResourceBundle: () => {},
}

export default i18next
