import React, { useState, useEffect } from "react"
import { Database } from "lucide-react"
import { vscode } from "../../utils/vscode"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { SetCachedStateField } from "./types"
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

interface CodeIndexSettingsProps {
	codeIndexEnabled: boolean
	codeIndexOpenAiKey: string
	codeIndexQdrantUrl: string
	setCachedStateField: SetCachedStateField<"codeIndexEnabled" | "codeIndexOpenAiKey" | "codeIndexQdrantUrl">
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codeIndexEnabled,
	codeIndexOpenAiKey,
	codeIndexQdrantUrl,
	setCachedStateField,
}) => {
	const [indexingState, setIndexingState] = useState("Standby")
	const [indexingMessage, setIndexingMessage] = useState("")

	useEffect(() => {
		if (!codeIndexEnabled) {
			setIndexingState("Standby")
			setIndexingMessage("")
			return
		}

		// Immediately request initial status
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates
		const intervalId = setInterval(() => {
			vscode.postMessage({ type: "requestIndexingStatus" })
		}, 3000)

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "indexingStatusUpdate") {
				setIndexingState(event.data.values.state)
				setIndexingMessage(event.data.values.message)
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			clearInterval(intervalId)
			window.removeEventListener("message", handleMessage)
		}
	}, [codeIndexEnabled])
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
					checked={codeIndexEnabled}
					onChange={(e: any) => setCachedStateField("codeIndexEnabled", e.target.checked)}>
					Enable Codebase Indexing
				</VSCodeCheckbox>

				{codeIndexEnabled && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<VSCodeTextField
								type="password"
								value={codeIndexOpenAiKey}
								onInput={(e: any) => setCachedStateField("codeIndexOpenAiKey", e.target.value)}>
								OpenAI API Key (for Embeddings)
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								Used to generate embeddings for code snippets.
							</p>
						</div>

						<div className="space-y-2">
							<VSCodeTextField
								value={codeIndexQdrantUrl}
								onInput={(e: any) => setCachedStateField("codeIndexQdrantUrl", e.target.value)}>
								Qdrant URL
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								URL of your running Qdrant vector database instance.
							</p>
						</div>

						<div className="text-sm text-vscode-descriptionForeground mt-4">
							Status: {indexingState}
							{indexingMessage ? ` - ${indexingMessage}` : ""}
						</div>

						<div className="flex gap-2 mt-4">
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })} // Added onClick
								disabled={!codeIndexOpenAiKey || !codeIndexQdrantUrl || indexingState === "Indexing"} // Added disabled logic
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
