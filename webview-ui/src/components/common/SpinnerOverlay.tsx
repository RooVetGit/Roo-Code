import React from "react"

interface SpinnerOverlayProps {
	isVisible: boolean
	message?: string
}

const SpinnerOverlay: React.FC<SpinnerOverlayProps> = ({ isVisible, message = "Processing..." }) => {
	if (!isVisible) return null

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-vscode-editor-background p-6 rounded-md shadow-lg flex flex-col items-center">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vscode-foreground mb-4"></div>
				<div className="text-vscode-foreground">{message}</div>
			</div>
		</div>
	)
}

export default SpinnerOverlay
