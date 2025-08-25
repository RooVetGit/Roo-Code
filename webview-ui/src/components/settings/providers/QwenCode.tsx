import React from "react"
import { VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { type ProviderSettings } from "@roo-code/types"

interface QwenCodeProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const QwenCode: React.FC<QwenCodeProps> = ({ apiConfiguration, setApiConfigurationField }) => {
	const handleInputChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const element = e.target as HTMLInputElement
		setApiConfigurationField("qwenCodeOauthPath", element.value)
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<VSCodeTextField
					value={apiConfiguration?.qwenCodeOauthPath || ""}
					style={{ width: "100%", marginTop: 3 }}
					type="text"
					onInput={handleInputChange}
					placeholder="~/.qwen/oauth_creds.json">
					OAuth Credentials Path
				</VSCodeTextField>

				<p
					style={{
						fontSize: "12px",
						marginTop: 3,
						color: "var(--vscode-descriptionForeground)",
					}}>
					Path to your Qwen OAuth credentials file. Use ~/.qwen/oauth_creds.json or provide a custom path.
				</p>

				<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginTop: "12px" }}>
					Qwen Code is an OAuth-based API that requires authentication through the official Qwen client.
					You&apos;ll need to set up OAuth credentials first.
				</div>

				<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginTop: "8px" }}>
					To get started:
					<br />
					1. Install the official Qwen client
					<br />
					2. Authenticate using your account
					<br />
					3. OAuth credentials will be stored automatically
				</div>

				<VSCodeLink
					href="https://github.com/QwenLM/qwen-code/blob/main/README.md"
					style={{
						color: "var(--vscode-textLink-foreground)",
						marginTop: "8px",
						display: "inline-block",
						fontSize: "12px",
					}}>
					Setup Instructions
				</VSCodeLink>
			</div>
		</div>
	)
}
