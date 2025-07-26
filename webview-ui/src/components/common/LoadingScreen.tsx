import React from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"

interface LoadingScreenProps {
	message?: string
	showTimeout?: boolean
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
	message = "Loading Roo Code...",
	showTimeout = false,
}) => {
	return (
		<div className="fixed inset-0 flex flex-col items-center justify-center bg-vscode-editor-background">
			<div className="flex flex-col items-center gap-4">
				<VSCodeProgressRing />
				<p className="text-vscode-foreground text-sm">{message}</p>
				{showTimeout && (
					<p className="text-vscode-descriptionForeground text-xs mt-2">Taking longer than expected...</p>
				)}
			</div>
		</div>
	)
}
