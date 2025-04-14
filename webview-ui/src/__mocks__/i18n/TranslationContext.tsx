import React, { ReactNode } from "react"
import i18next from "./setup"

// Create a mock context
export const TranslationContext = React.createContext<{
	t: (key: string, options?: Record<string, any>) => string
	i18n: typeof i18next
}>({
	t: (key: string, options?: Record<string, any>) => {
		// Handle specific test cases
		if (key === "settings.autoApprove.title") {
			return "Auto-Approve"
		}
		if (key === "notifications.error" && options?.message) {
			return `Operation failed: ${options.message}`
		}
		return key // Default fallback
	},
	i18n: i18next,
})

// Mock translation provider
export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	return (
		<TranslationContext.Provider
			value={{
				t: (key: string, options?: Record<string, any>) => {
					// Handle specific test cases
					if (key === "settings.autoApprove.title") {
						return "Auto-Approve"
					}
					if (key === "notifications.error" && options?.message) {
						return `Operation failed: ${options.message}`
					}
					return key // Default fallback
				},
				i18n: i18next,
			}}>
			{children}
		</TranslationContext.Provider>
	)
}

// Custom hook for easy translations
export const useAppTranslation = () => React.useContext(TranslationContext)

export default TranslationProvider

// Mock Trans component
export const Trans: React.FC<any> = ({ i18nKey, children, components, values }) => {
	// Simple mock: render children or the key
	if (children) {
		// If children are provided, attempt to render them.
		// This handles cases where Trans wraps other components or text.
		return <>{children}</>
	}

	// Attempt to replace placeholders in the key if values are provided
	let renderedKey = i18nKey || "mock-trans"
	if (values) {
		Object.keys(values).forEach((key) => {
			const regex = new RegExp(`{{${key}}}`, "g")
			// Ensure value is a string or number before replacing
			const replacement = typeof values[key] === "string" || typeof values[key] === "number" ? values[key] : ""
			renderedKey = renderedKey.replace(regex, replacement)
		})
	}

	// Basic handling for components prop if needed for specific tests,
	// otherwise just return the processed key.
	// A more sophisticated mock might try to interpolate React elements from `components`.
	// For now, returning the processed string key is often sufficient for rendering tests.
	return <>{renderedKey}</>
}
