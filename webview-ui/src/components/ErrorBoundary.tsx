import React, { Component } from "react"
import { telemetryClient } from "@src/utils/TelemetryClient"
import { withTranslation, WithTranslation } from "react-i18next"

type ErrorProps = {
	children: React.ReactNode
} & WithTranslation

type ErrorState = {
	error?: string
	componentStack?: string | null
	timestamp?: number
}

class ErrorBoundary extends Component<ErrorProps, ErrorState> {
	constructor(props: ErrorProps) {
		super(props)
		this.state = {}
	}

	static getDerivedStateFromError(error: unknown) {
		// Ensure we're getting the full stack trace with source maps
		let errorMessage = ""

		if (error instanceof Error) {
			// Use Error.stack which should include source-mapped locations
			errorMessage = error.stack ?? error.message

			// If we have access to sourcemap-related properties, use them
			if ("sourceMappedStack" in error && typeof error.sourceMappedStack === "string") {
				errorMessage = error.sourceMappedStack
			}
		} else {
			errorMessage = `${error}`
		}

		return {
			error: errorMessage,
			timestamp: Date.now(),
		}
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Process the component stack to ensure it uses source maps
		const componentStack = errorInfo.componentStack || ""

		// Format the error stack to highlight TypeScript files
		const formattedStack = this.formatStackTrace(error.stack || "")

		// Log to telemetry with enhanced error information
		telemetryClient.capture("error_boundary_caught_error", {
			error: error.message,
			stack: formattedStack,
			componentStack: componentStack,
			timestamp: Date.now(),
			sourceMapEnabled: true, // Flag to indicate we're trying to use source maps
			errorType: error.name,
			errorLocation: this.extractErrorLocation(error),
		})

		// Update state with component stack and formatted stack
		this.setState({
			error: formattedStack,
			componentStack: componentStack,
		})
	}

	// Helper method to extract location information from error
	private extractErrorLocation(error: Error): string {
		if (!error.stack) return "unknown"

		// Try to extract the first line with a file path from the stack
		const stackLines = error.stack.split("\n")
		for (const line of stackLines) {
			// Look for TypeScript file references (.ts or .tsx)
			if (line.includes(".ts:") || line.includes(".tsx:")) {
				return line.trim()
			}
		}

		// Fallback to the first line with any file reference
		for (const line of stackLines) {
			if (line.includes("(") && line.includes(")") && line.includes(":")) {
				return line.trim()
			}
		}

		return "unknown"
	}

	// Format stack trace to highlight TypeScript files
	private formatStackTrace(stack: string): string {
		if (!stack) return ""

		const lines = stack.split("\n")
		const formattedLines = lines.map((line) => {
			// Highlight TypeScript file references
			if (line.includes(".ts:") || line.includes(".tsx:")) {
				// Extract the TypeScript file path and line/column numbers
				const match =
					line.match(/\(([^)]+\.tsx?):(\d+):(\d+)\)/) || line.match(/at\s+([^)]+\.tsx?):(\d+):(\d+)/)

				if (match) {
					const [_, filePath, lineNum, colNum] = match
					// Format with the TypeScript file path highlighted
					return line.replace(match[0], `(${filePath}:${lineNum}:${colNum})`)
				}
			}
			return line
		})

		return formattedLines.join("\n")
	}

	render() {
		const { t } = this.props

		if (!this.state.error) {
			return this.props.children
		}

		// In production, truncate the error details to avoid exposing sensitive info
		const isProduction = process.env.NODE_ENV === "production"

		// Format the error stack
		const errorDisplay = isProduction ? this.state.error?.split("\n").slice(0, 3).join("\n") : this.state.error

		// Format the component stack if available
		const componentStackDisplay = isProduction
			? this.state.componentStack?.split("\n").slice(0, 3).join("\n")
			: this.state.componentStack

		// Get the package version from environment variables
		const version = process.env.PKG_VERSION || "unknown"

		return (
			<div>
				<h2 className="text-lg font-bold mt-0 mb-2">
					{t("errorBoundary.title")} (v{version})
				</h2>
				<p className="mb-4">
					{t("errorBoundary.reportText")}{" "}
					<a href="https://github.com/RooCodeInc/Roo-Code/issues" target="_blank" rel="noreferrer">
						{t("errorBoundary.githubText")}
					</a>
				</p>
				<p className="mb-2">{t("errorBoundary.copyInstructions")}</p>

				{/* Error stack trace */}
				<div className="mb-4">
					<h3 className="text-md font-bold mb-1">{t("errorBoundary.errorStack")}</h3>
					<pre className="p-2 border rounded text-sm overflow-auto">{errorDisplay}</pre>
				</div>

				{/* Component stack trace - only show if available */}
				{componentStackDisplay && (
					<div>
						<h3 className="text-md font-bold mb-1">{t("errorBoundary.componentStack")}</h3>
						<pre className="p-2 border rounded text-sm overflow-auto">{componentStackDisplay}</pre>
					</div>
				)}
			</div>
		)
	}
}

export default withTranslation("common")(ErrorBoundary)
