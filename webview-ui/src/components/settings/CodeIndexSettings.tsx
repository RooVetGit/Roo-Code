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
import { SetCachedStateField } from "./types"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { ApiConfiguration } from "../../../../src/shared/api"
import { CodebaseIndexConfig } from "../../../../src/schemas"

interface CodeIndexSettingsProps {
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	apiConfiguration: ApiConfiguration
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codebaseIndexConfig,
	apiConfiguration,
	setCachedStateField,
	setApiConfigurationField,
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
	}, [codebaseIndexConfig])
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
					checked={codebaseIndexConfig?.codebaseIndexEnabled}
					onChange={(e: any) =>
						setCachedStateField("codebaseIndexConfig", {
							...codebaseIndexConfig,
							codebaseIndexEnabled: e.target.checked,
						})
					}>
					Enable Codebase Indexing
				</VSCodeCheckbox>

				{codebaseIndexConfig?.codebaseIndexEnabled && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<VSCodeTextField
								type="password"
								value={apiConfiguration.codeIndexOpenAiKey || ""}
								onInput={(e: any) => setApiConfigurationField("codeIndexOpenAiKey", e.target.value)}>
								OpenAI API Key (for Embeddings)
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								Used to generate embeddings for code snippets.
							</p>
						</div>

						<div className="space-y-2">
							<VSCodeTextField
								value={codebaseIndexConfig.codebaseIndexQdrantUrl}
								onInput={(e: any) =>
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexQdrantUrl: e.target.value,
									})
								}>
								Qdrant URL
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								URL of your running Qdrant vector database instance.
							</p>
						</div>

						<div className="space-y-2">
							<VSCodeTextField
								type="password"
								value={apiConfiguration.codeIndexQdrantApiKey}
								onInput={(e: any) => setApiConfigurationField("codeIndexQdrantApiKey", e.target.value)}>
								Qdrant API Key
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								API key for authenticating with your Qdrant instance.
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
									!apiConfiguration.codeIndexOpenAiKey ||
									!apiConfiguration.codeIndexQdrantApiKey ||
									systemStatus === "Indexing"
								} // Added disabled logic
							>
								Start Indexing
							</VSCodeButton>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">Clear Index Data</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you sure?</AlertDialogTitle>
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete your codebase
											index data.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											// Removed variant="destructive"
											onClick={() => vscode.postMessage({ type: "clearIndexData" })} // Added onClick
										>
											Clear Data
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
