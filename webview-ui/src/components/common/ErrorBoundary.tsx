import React from "react"
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from "react-error-boundary"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { errorReporter } from "../../utils/errorReporting"

interface ErrorFallbackProps extends FallbackProps {
	componentName?: string
}

function ErrorFallback({ error, resetErrorBoundary, componentName }: ErrorFallbackProps) {
	const { t } = useTranslation("common")

	return (
		<div className="flex flex-col items-center justify-center p-6 bg-vscode-editor-background border border-vscode-widget-border rounded-md m-4">
			<div className="flex items-center mb-4">
				<span className="codicon codicon-error text-vscode-errorForeground text-2xl mr-3" />
				<h2 className="text-lg font-semibold text-vscode-editor-foreground">
					{t("errorBoundary.title", "Something went wrong")}
				</h2>
			</div>

			{componentName && (
				<p className="text-sm text-vscode-descriptionForeground mb-2">
					{t("errorBoundary.componentError", "Error in {{componentName}} component", { componentName })}
				</p>
			)}

			<p className="text-sm text-vscode-descriptionForeground mb-4 text-center max-w-md">
				{t(
					"errorBoundary.description",
					"An error occurred in this part of the interface. You can try to recover by clicking the button below.",
				)}
			</p>

			<details className="mb-4 w-full max-w-md">
				<summary className="cursor-pointer text-sm text-vscode-descriptionForeground hover:text-vscode-editor-foreground">
					{t("errorBoundary.showDetails", "Show error details")}
				</summary>
				<pre className="mt-2 p-3 bg-vscode-textCodeBlock-background border border-vscode-widget-border rounded text-xs text-vscode-editor-foreground overflow-auto max-h-32">
					{error.message}
					{error.stack && (
						<>
							{"\n\n"}
							{error.stack}
						</>
					)}
				</pre>
			</details>

			<VSCodeButton appearance="primary" onClick={resetErrorBoundary}>
				{t("errorBoundary.retry", "Try again")}
			</VSCodeButton>
		</div>
	)
}

interface ErrorBoundaryProps {
	children: React.ReactNode
	componentName?: string
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function ErrorBoundary({ children, componentName, onError }: ErrorBoundaryProps) {
	const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
		// Report error using our error reporting utility
		errorReporter.reportError(error, errorInfo, componentName)

		// Call custom error handler if provided (for potential Sentry integration)
		onError?.(error, errorInfo)
	}

	return (
		<ReactErrorBoundary
			FallbackComponent={(props) => <ErrorFallback {...props} componentName={componentName} />}
			onError={handleError}>
			{children}
		</ReactErrorBoundary>
	)
}

export default ErrorBoundary
