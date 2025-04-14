module.exports = {
	useTranslation: () => ({
		t: (key) => key, // Return key itself for simplicity
		i18n: {
			changeLanguage: () => new Promise(() => {}),
			// Add other i18n properties/methods if needed by the component
		},
	}),
	// Mock other exports from react-i18next if necessary
}
