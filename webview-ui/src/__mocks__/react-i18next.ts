// Mock for react-i18next

export const initReactI18next = {
	type: "3rdParty",
	init: () => {},
}

// Mock the useTranslation hook
export const useTranslation = () => ({
	t: (key: string) => {
		// Handle number format suffixes
		if (key === "number_format.million_suffix") return "M"
		if (key === "number_format.thousand_suffix") return "K"

		// Return the key part after the colon or the whole key if no colon
		const parts = key.split(":")
		return parts.length > 1 ? parts[1] : key
	},
	i18n: {
		changeLanguage: () => new Promise(() => {}),
		t: (key: string) => {
			if (key === "number_format.million_suffix") return "M"
			if (key === "number_format.thousand_suffix") return "K"
			const parts = key.split(":")
			return parts.length > 1 ? parts[1] : key
		},
	},
})

// Mock the Trans component
export const Trans = ({ children }: { children: any }) => children
