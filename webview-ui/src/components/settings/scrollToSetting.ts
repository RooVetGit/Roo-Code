/**
 * Scrolls to a specific setting element by its data-setting-id attribute
 * @param settingId - The ID of the setting to scroll to
 */
export function scrollToSetting(settingId: string): void {
	if (!settingId) {
		return
	}

	// Find the element with the data-setting-id attribute
	const element = document.querySelector(`[data-setting-id="${settingId}"]`)

	if (element) {
		// Scroll the element into view with smooth behavior
		element.scrollIntoView({
			behavior: "smooth",
			block: "center",
		})

		// Add a highlight animation to draw attention
		element.classList.add("search-highlight")

		// Remove the highlight after animation completes
		setTimeout(() => {
			element.classList.remove("search-highlight")
		}, 2000)
	}
}
