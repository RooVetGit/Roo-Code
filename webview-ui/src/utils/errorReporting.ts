/**
 * Error reporting utility for the webview
 * This can be extended to integrate with services like Sentry in the future
 */

export interface ErrorReport {
	error: Error
	errorInfo?: React.ErrorInfo
	componentName?: string
	timestamp: number
	userAgent: string
	url: string
}

class ErrorReporter {
	private errors: ErrorReport[] = []
	private maxErrors = 50 // Keep only the last 50 errors

	/**
	 * Report an error that occurred in a React component
	 */
	reportError(error: Error, errorInfo?: React.ErrorInfo, componentName?: string): void {
		const errorReport: ErrorReport = {
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			} as Error,
			errorInfo,
			componentName,
			timestamp: Date.now(),
			userAgent: navigator.userAgent,
			url: window.location.href,
		}

		// Add to local storage for debugging
		this.errors.push(errorReport)
		if (this.errors.length > this.maxErrors) {
			this.errors.shift()
		}

		// Log to console for development
		console.error(`Error in ${componentName || "component"}:`, error, errorInfo)

		// TODO: In the future, this could send errors to Sentry or another service
		// Example:
		// if (window.Sentry) {
		//   window.Sentry.captureException(error, {
		//     tags: { component: componentName },
		//     extra: errorInfo
		//   })
		// }
	}

	/**
	 * Get all stored error reports (useful for debugging)
	 */
	getErrors(): ErrorReport[] {
		return [...this.errors]
	}

	/**
	 * Clear all stored errors
	 */
	clearErrors(): void {
		this.errors = []
	}

	/**
	 * Get error statistics
	 */
	getErrorStats(): { total: number; byComponent: Record<string, number> } {
		const byComponent: Record<string, number> = {}

		this.errors.forEach((error) => {
			const component = error.componentName || "unknown"
			byComponent[component] = (byComponent[component] || 0) + 1
		})

		return {
			total: this.errors.length,
			byComponent,
		}
	}
}

// Export a singleton instance
export const errorReporter = new ErrorReporter()

// Make it available globally for debugging in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
	;(window as any).errorReporter = errorReporter
}
