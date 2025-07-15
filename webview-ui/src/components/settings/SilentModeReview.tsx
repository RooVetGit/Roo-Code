import React, { useState } from "react"
import { VSCodeBadge, VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface FileChange {
	filePath: string
	operation: "create" | "modify" | "delete"
	originalContent?: string
	newContent?: string
	diff?: string
	timestamp: number
}

interface ChangeSummary {
	filesChanged: number
	linesAdded: number
	linesRemoved: number
	changes: FileChange[]
}

interface SilentModeReviewProps {
	taskId: string
	changes: FileChange[]
	summary: ChangeSummary
	onApprove: (approvedChanges: FileChange[]) => void
	onReject: () => void
	onCancel: () => void
}

export const SilentModeReview: React.FC<SilentModeReviewProps> = ({
	taskId: _taskId,
	changes,
	summary,
	onApprove,
	onReject,
	onCancel,
}) => {
	const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
		new Set(changes.map((change) => change.filePath)),
	)
	const [viewingChange, setViewingChange] = useState<FileChange | null>(null)

	const toggleChangeSelection = (filePath: string, checked: boolean) => {
		const newSelection = new Set(selectedChanges)
		if (checked) {
			newSelection.add(filePath)
		} else {
			newSelection.delete(filePath)
		}
		setSelectedChanges(newSelection)
	}

	const handleApprove = () => {
		const approvedChanges = changes.filter((change) => selectedChanges.has(change.filePath))
		onApprove(approvedChanges)
	}

	const getOperationIcon = (operation: string) => {
		switch (operation) {
			case "create":
				return "📄"
			case "modify":
				return "✏️"
			case "delete":
				return "🗑️"
			default:
				return "📄"
		}
	}

	const formatTimestamp = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString()
	}

	if (viewingChange) {
		return (
			<div className="p-4 border rounded-lg">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-medium">
						{getOperationIcon(viewingChange.operation)} {viewingChange.filePath}
					</h3>
					<VSCodeButton appearance="secondary" onClick={() => setViewingChange(null)}>
						Back to List
					</VSCodeButton>
				</div>

				<div className="space-y-4">
					<div className="flex items-center gap-4">
						<VSCodeBadge>{viewingChange.operation.toUpperCase()}</VSCodeBadge>
						<span className="text-sm opacity-80">{formatTimestamp(viewingChange.timestamp)}</span>
					</div>

					{viewingChange.diff && (
						<div>
							<h4 className="font-medium mb-2">Changes:</h4>
							<div className="max-h-96 overflow-auto border rounded p-4 bg-background">
								<pre className="text-sm whitespace-pre-wrap font-mono">{viewingChange.diff}</pre>
							</div>
						</div>
					)}

					{viewingChange.operation === "create" && viewingChange.newContent && (
						<div>
							<h4 className="font-medium mb-2">New File Content:</h4>
							<div className="max-h-96 overflow-auto border rounded p-4 bg-background">
								<pre className="text-sm whitespace-pre-wrap font-mono">{viewingChange.newContent}</pre>
							</div>
						</div>
					)}
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 space-y-6">
			<div>
				<h2 className="text-xl font-medium mb-2">🕐 Silent Mode Task Completed</h2>
				<p className="text-sm opacity-80">Review and approve the changes made during silent mode operation.</p>
			</div>

			{/* Summary */}
			<div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
				<div className="text-center">
					<div className="text-2xl font-bold">{summary.filesChanged}</div>
					<div className="text-sm opacity-80">Files Changed</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-green-600">+{summary.linesAdded}</div>
					<div className="text-sm opacity-80">Lines Added</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-red-600">-{summary.linesRemoved}</div>
					<div className="text-sm opacity-80">Lines Removed</div>
				</div>
			</div>

			{/* File Changes List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">File Changes</h3>
					<div className="flex gap-2">
						<VSCodeButton
							appearance="secondary"
							onClick={() => setSelectedChanges(new Set(changes.map((c) => c.filePath)))}>
							Select All
						</VSCodeButton>
						<VSCodeButton appearance="secondary" onClick={() => setSelectedChanges(new Set())}>
							Select None
						</VSCodeButton>
					</div>
				</div>

				<div className="max-h-64 overflow-auto space-y-2">
					{changes.map((change, index) => (
						<div
							key={index}
							className="flex items-center justify-between p-3 border rounded-lg hover:bg-opacity-10 hover:bg-white">
							<div className="flex items-center gap-3">
								<VSCodeCheckbox
									checked={selectedChanges.has(change.filePath)}
									onChange={(e) =>
										toggleChangeSelection(change.filePath, (e.target as HTMLInputElement).checked)
									}
								/>
								<span className="text-lg">{getOperationIcon(change.operation)}</span>
								<div className="flex-1">
									<div className="font-medium">{change.filePath}</div>
									<div className="text-sm opacity-80">{formatTimestamp(change.timestamp)}</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<VSCodeBadge>{change.operation}</VSCodeBadge>
								<VSCodeButton
									appearance="icon"
									onClick={() => setViewingChange(change)}
									aria-label="View changes">
									👁️
								</VSCodeButton>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Actions */}
			<div className="flex justify-between pt-4 border-t">
				<VSCodeButton appearance="secondary" onClick={onCancel}>
					Cancel
				</VSCodeButton>
				<div className="flex gap-2">
					<VSCodeButton appearance="secondary" onClick={onReject}>
						Reject All Changes
					</VSCodeButton>
					<VSCodeButton appearance="primary" onClick={handleApprove} disabled={selectedChanges.size === 0}>
						✅ Apply Selected Changes ({selectedChanges.size})
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}

export default SilentModeReview
