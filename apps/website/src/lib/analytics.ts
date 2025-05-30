import posthog from "posthog-js"

/**
 * Checks if analytics are enabled (client-side and API key exists)
 * @returns Boolean indicating if analytics are enabled
 */
const isAnalyticsEnabled = (): boolean => {
	return typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_POSTHOG_KEY
}

/**
 * Executes a callback function only if analytics are enabled
 * @param callback The function to execute if analytics are enabled
 * @returns The result of the callback, or undefined if analytics are disabled
 */
const executeIfAnalyticsEnabled = <T>(callback: () => T): T | undefined => {
	if (isAnalyticsEnabled()) {
		try {
			return callback()
		} catch (error) {
			console.error("Error in PostHog callback:", error)
		}
	}
	return undefined
}

/**
 * Track a custom event with optional properties
 * @param eventName The name of the event to track
 * @param properties Optional properties to include with the event
 */
export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
	executeIfAnalyticsEnabled(() => posthog.capture(eventName, properties))
}

/**
 * Identify a user with optional properties
 * @param userId The unique identifier for the user
 * @param properties Optional user properties to set
 */
export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
	executeIfAnalyticsEnabled(() => posthog.identify(userId, properties))
}

/**
 * Reset the current user's identity (typically used on logout)
 */
export const resetUser = () => {
	executeIfAnalyticsEnabled(() => posthog.reset())
}

/**
 * Enable or disable session recording
 * @param enabled Whether session recording should be enabled
 */
export const setSessionRecording = (enabled: boolean) => {
	executeIfAnalyticsEnabled(() => {
		if (enabled) {
			posthog.startSessionRecording()
		} else {
			posthog.stopSessionRecording()
		}
	})
}

/**
 * Check if the current user has opted out of tracking
 * @returns Boolean indicating if the user has opted out
 */
export const hasOptedOut = (): boolean => {
	return executeIfAnalyticsEnabled(() => posthog.has_opted_out_capturing()) ?? false
}

/**
 * Opt out of tracking for the current user
 */
export const optOut = () => {
	executeIfAnalyticsEnabled(() => posthog.opt_out_capturing())
}

/**
 * Opt in to tracking for the current user
 */
export const optIn = () => {
	executeIfAnalyticsEnabled(() => posthog.opt_in_capturing())
}
