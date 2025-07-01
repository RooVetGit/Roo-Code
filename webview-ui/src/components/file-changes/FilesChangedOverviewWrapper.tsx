import React from "react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import FilesChangedOverview from "./FilesChangedOverview"

const FilesChangedOverviewWrapper: React.FC = () => {
	const { currentFileChangeset } = useExtensionState()

	// Don't render if no files changed
	if (!currentFileChangeset || currentFileChangeset.files.length === 0) {
		return null
	}

	const handleViewDiff = (uri: string) => {
		vscode.postMessage({
			type: "viewDiff",
			uri,
		})
	}

	const handleAcceptFile = (uri: string) => {
		vscode.postMessage({
			type: "acceptFileChange",
			uri,
		})
	}

	const handleRejectFile = (uri: string) => {
		vscode.postMessage({
			type: "rejectFileChange",
			uri,
		})
	}

	const handleAcceptAll = () => {
		vscode.postMessage({
			type: "acceptAllFileChanges",
		})
	}

	const handleRejectAll = () => {
		vscode.postMessage({
			type: "rejectAllFileChanges",
		})
	}

	return (
		<FilesChangedOverview
			changeset={currentFileChangeset}
			onViewDiff={handleViewDiff}
			onAcceptFile={handleAcceptFile}
			onRejectFile={handleRejectFile}
			onAcceptAll={handleAcceptAll}
			onRejectAll={handleRejectAll}
		/>
	)
}

export default FilesChangedOverviewWrapper
