import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en/en.json"
import zh_CN from "./locales/zh-cn/zh-CN.json"

// Get user's browser language
const userLanguage = navigator.language.toLowerCase()
const defaultLanguage = userLanguage.startsWith("zh-cn") ? "zh_CN" : "en"
i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: en,
		},
		zh_CN: {
			translation: zh_CN,
		},
	},
	lng: defaultLanguage,
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
})

export default i18n
