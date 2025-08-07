import React from "react"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"

interface GoogleCloudTtsSettingsProps {
	apiKey?: string
	projectId?: string
	onApiKeyChange: (value: string) => void
	onProjectIdChange: (value: string) => void
}

export const GoogleCloudTtsSettings: React.FC<GoogleCloudTtsSettingsProps> = ({
	apiKey,
	projectId,
	onApiKeyChange,
	onProjectIdChange,
}) => {
	const handleTestConnection = async () => {
		// Test the connection with the provided credentials
		vscode.postMessage({
			type: "playTts",
			text: "Testing Google Cloud Text-to-Speech connection.",
		})
	}

	return (
		<div className="flex flex-col gap-4 p-4 border border-vscode-panel-border rounded">
			<h4 className="text-sm font-semibold">Google Cloud TTS Configuration</h4>

			<div className="flex flex-col gap-2">
				<label htmlFor="gc-api-key" className="text-xs text-vscode-descriptionForeground">
					API Key
				</label>
				<VSCodeTextField
					id="gc-api-key"
					type="password"
					value={apiKey || ""}
					placeholder="Enter your Google Cloud API key"
					onInput={(e: any) => onApiKeyChange(e.target.value)}
					className="w-full"
				/>
				<span className="text-xs text-vscode-descriptionForeground">
					Your Google Cloud API key for Text-to-Speech service
				</span>
			</div>

			<div className="flex flex-col gap-2">
				<label htmlFor="gc-project-id" className="text-xs text-vscode-descriptionForeground">
					Project ID (Optional)
				</label>
				<VSCodeTextField
					id="gc-project-id"
					value={projectId || ""}
					placeholder="Enter your Google Cloud project ID"
					onInput={(e: any) => onProjectIdChange(e.target.value)}
					className="w-full"
				/>
				<span className="text-xs text-vscode-descriptionForeground">
					Your Google Cloud project ID (optional for API key authentication)
				</span>
			</div>

			<div className="flex gap-2">
				<VSCodeButton onClick={handleTestConnection}>Test Connection</VSCodeButton>
				<VSCodeButton
					appearance="secondary"
					onClick={() => window.open("https://cloud.google.com/text-to-speech/docs/quickstart", "_blank")}>
					Documentation
				</VSCodeButton>
			</div>

			<div className="text-xs text-vscode-descriptionForeground">
				<p className="mb-2">To get started:</p>
				<ol className="list-decimal list-inside space-y-1">
					<li>Enable the Text-to-Speech API in your Google Cloud Console</li>
					<li>Create an API key in the Credentials section</li>
					<li>Enter your API key above</li>
				</ol>
			</div>
		</div>
	)
}
