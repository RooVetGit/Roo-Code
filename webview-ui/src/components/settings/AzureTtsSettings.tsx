import React from "react"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"

interface AzureTtsSettingsProps {
	subscriptionKey?: string
	region?: string
	onSubscriptionKeyChange: (value: string) => void
	onRegionChange: (value: string) => void
}

export const AzureTtsSettings: React.FC<AzureTtsSettingsProps> = ({
	subscriptionKey,
	region,
	onSubscriptionKeyChange,
	onRegionChange,
}) => {
	const handleTestConnection = async () => {
		// Test the connection with the provided credentials
		vscode.postMessage({
			type: "playTts",
			text: "Testing Azure Speech Services connection.",
		})
	}

	return (
		<div className="flex flex-col gap-4 p-4 border border-vscode-panel-border rounded">
			<h4 className="text-sm font-semibold">Azure Speech Services Configuration</h4>

			<div className="flex flex-col gap-2">
				<label htmlFor="azure-key" className="text-xs text-vscode-descriptionForeground">
					Subscription Key
				</label>
				<VSCodeTextField
					id="azure-key"
					type="password"
					value={subscriptionKey || ""}
					placeholder="Enter your Azure subscription key"
					onInput={(e: any) => onSubscriptionKeyChange(e.target.value)}
					className="w-full"
				/>
				<span className="text-xs text-vscode-descriptionForeground">
					Your Azure Speech Services subscription key
				</span>
			</div>

			<div className="flex flex-col gap-2">
				<label htmlFor="azure-region" className="text-xs text-vscode-descriptionForeground">
					Region
				</label>
				<VSCodeTextField
					id="azure-region"
					value={region || ""}
					placeholder="e.g., eastus, westeurope"
					onInput={(e: any) => onRegionChange(e.target.value)}
					className="w-full"
				/>
				<span className="text-xs text-vscode-descriptionForeground">
					The Azure region where your Speech Services resource is located
				</span>
			</div>

			<div className="flex gap-2">
				<VSCodeButton onClick={handleTestConnection}>Test Connection</VSCodeButton>
				<VSCodeButton
					appearance="secondary"
					onClick={() =>
						window.open("https://docs.microsoft.com/azure/cognitive-services/speech-service/", "_blank")
					}>
					Documentation
				</VSCodeButton>
			</div>

			<div className="text-xs text-vscode-descriptionForeground">
				<p className="mb-2">To get started:</p>
				<ol className="list-decimal list-inside space-y-1">
					<li>Create a Speech Services resource in Azure Portal</li>
					<li>Copy your subscription key from the Keys and Endpoint section</li>
					<li>Note your region (e.g., eastus, westeurope)</li>
					<li>Enter your credentials above</li>
				</ol>
			</div>
		</div>
	)
}
