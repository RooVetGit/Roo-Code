import React, { useState, useEffect } from "react"
import { Database } from "lucide-react"
import { vscode } from "../../utils/vscode"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { CodeIndexConfiguration } from "../../../../src/schemas"

interface CodeIndexSettingsProps {
	codeIndexConfiguration: CodeIndexConfiguration
	setCodeIndexConfigurationField: <K extends keyof CodeIndexConfiguration>(
		field: K,
		value: CodeIndexConfiguration[K],
	) => void
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codeIndexConfiguration,
	setCodeIndexConfigurationField,
}) => {
	const [systemStatus, setSystemStatus] = useState("Standby")
	const [indexingMessage, setIndexingMessage] = useState("")

	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setSystemStatus(event.data.values.systemStatus)
				setIndexingMessage(event.data.values.message || "")
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [codeIndexConfiguration.codeIndexEnabled])
	return (
		<>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database size={16} />
					Codebase Indexing
				</div>
			</SectionHeader>
			<Section>
				<VSCodeCheckbox
					checked={codeIndexConfiguration.codeIndexEnabled}
					onChange={(e: any) => setCodeIndexConfigurationField("codeIndexEnabled", e.target.checked)}>
					Enable Codebase Indexing
				</VSCodeCheckbox>

				{codeIndexConfiguration.codeIndexEnabled && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<VSCodeTextField
								type="password"
								value={codeIndexConfiguration.codeIndexOpenAiKey}
								onInput={(e: any) =>
									setCodeIndexConfigurationField("codeIndexOpenAiKey", e.target.value)
								}>
								OpenAI API Key (for Embeddings)
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								Used to generate embeddings for code snippets.
							</p>
						</div>

						<div className="space-y-2">
							<VSCodeTextField
								value={codeIndexConfiguration.codeIndexQdrantUrl}
								onInput={(e: any) =>
									setCodeIndexConfigurationField("codeIndexQdrantUrl", e.target.value)
								}>
								Qdrant URL
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								URL of your running Qdrant vector database instance.
							</p>
						</div>

						<div className="text-sm text-vscode-descriptionForeground mt-4">
							<span
								className={`
									inline-block w-3 h-3 rounded-full mr-2
									${
										systemStatus === "Standby"
											? "bg-gray-400"
											: systemStatus === "Indexing"
												? "bg-yellow-500 animate-pulse"
												: systemStatus === "Indexed"
													? "bg-green-500"
													: systemStatus === "Error"
														? "bg-red-500"
														: "bg-gray-400"
									}
								`}></span>
							{systemStatus}
							{indexingMessage ? ` - ${indexingMessage}` : ""}
						</div>

						<div className="flex gap-2 mt-4">
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })} // Added onClick
								disabled={
									!codeIndexConfiguration.codeIndexOpenAiKey ||
									!codeIndexConfiguration.codeIndexQdrantUrl ||
									systemStatus === "Indexing"
								} // Added disabled logic
							>
								Start Indexing {/* Reverted translation */}
							</VSCodeButton>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										Clear Index Data {/* Reverted translation */}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you sure?</AlertDialogTitle> {/* Reverted translation */}
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete your codebase
											index data. {/* Reverted translation */}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel> {/* Reverted translation */}
										<AlertDialogAction
											// Removed variant="destructive"
											onClick={() => vscode.postMessage({ type: "clearIndexData" })} // Added onClick
										>
											Clear Data {/* Reverted translation */}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				)}
			</Section>
		</>
	)
}
