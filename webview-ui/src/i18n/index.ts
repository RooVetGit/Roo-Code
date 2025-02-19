import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import zh from "./locales/zh.json"

// Get user's browser language
const userLanguage = navigator.language.toLowerCase()
const defaultLanguage = userLanguage.startsWith("zh") ? "zh" : "en"
i18n.use(initReactI18next).init({
	resources: {
		en: {
			translation: en,
		},
		zh: {
			translation: zh,
		},
	},
	lng: defaultLanguage,
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
})

export default i18n
