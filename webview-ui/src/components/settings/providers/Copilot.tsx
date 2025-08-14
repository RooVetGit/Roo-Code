import { useState, useCallback, useEffect } from "react"
import { useEvent } from "react-use"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type ModelInfo, copilotDefaultModelId } from "@roo-code/types"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { vscode } from "@src/utils/vscode"
import { ModelPicker } from "../ModelPicker"
import { OrganizationAllowList } from "@roo/cloud"

type CopilotProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const Copilot = ({
	apiConfiguration,
	setApiConfigurationField,
	modelValidationError,
	organizationAllowList,
}: CopilotProps) => {
	const { t } = useAppTranslation()

	const [copilotModels, setCopilotModels] = useState<Record<string, ModelInfo> | null>(null)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isAuthenticating, setIsAuthenticating] = useState(false)
	const [deviceCodeInfo, setDeviceCodeInfo] = useState<{
		user_code: string
		verification_uri: string
		expires_in: number
	} | null>(null)
	const [authError, setAuthError] = useState<string | null>(null)

	const handleAuthenticateClick = useCallback(() => {
		setIsAuthenticating(true)
		setAuthError(null)
		setDeviceCodeInfo(null)
		// Send message to extension to start device code authentication
		vscode.postMessage({
			type: "authenticateCopilot",
		})
	}, [])

	const handleClearAuthClick = useCallback(() => {
		// Send message to extension to clear authentication
		vscode.postMessage({
			type: "clearCopilotAuth",
		})
		setIsAuthenticated(false)
		setCopilotModels(null)
		setDeviceCodeInfo(null)
		setAuthError(null)
	}, [])

	const handleRefreshModels = useCallback(() => {
		if (!isAuthenticated) {
			return
		}

		// Send message to extension to fetch Copilot models
		vscode.postMessage({
			type: "requestCopilotModels",
		})
	}, [isAuthenticated])

	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			switch (message.type) {
				case "copilotModels": {
					const updatedModels = message.copilotModels ?? {}
					setCopilotModels(updatedModels)
					break
				}
				case "copilotAuthStatus": {
					setIsAuthenticated(message.copilotAuthenticated ?? false)
					setIsAuthenticating(false)
					if (message.copilotAuthenticated) {
						// Clear device code info and error on successful auth
						setDeviceCodeInfo(null)
						setAuthError(null)
						// Auto-refresh models when authentication succeeds
						handleRefreshModels()
					}
					break
				}
				case "copilotDeviceCode": {
					// Show device code info to user
					if (message.copilotDeviceCode) {
						setDeviceCodeInfo(message.copilotDeviceCode)
					}
					break
				}
				case "copilotAuthError": {
					setIsAuthenticating(false)
					setDeviceCodeInfo(null)
					setAuthError(message.error || "Authentication failed")
					console.error("Copilot authentication error:", message.error)
					break
				}
			}
		},
		[handleRefreshModels],
	)

	useEvent("message", onMessage)

	// Check authentication status on component mount
	useEffect(() => {
		vscode.postMessage({
			type: "checkCopilotAuth",
		})
	}, [])

	// Auto-refresh models when authenticated status changes
	useEffect(() => {
		if (isAuthenticated) {
			handleRefreshModels()
		} else {
			setCopilotModels(null)
		}
	}, [isAuthenticated, handleRefreshModels])

	return (
		<>
			<div className="mb-4 p-4 bg-vscode-editor-background border border-vscode-focusBorder rounded">
				<h3 className="font-medium mb-2">{t("settings:providers.copilotAuthentication")}</h3>
				<div className="text-sm text-vscode-descriptionForeground mb-4">
					{t("settings:providers.copilotDeviceCodeNotice")}
				</div>

				{/* Error message */}
				{authError && (
					<div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
						<div className="font-medium mb-1">❌ Authentication Failed</div>
						<div>{authError}</div>
					</div>
				)}

				{/* Device code information */}
				{deviceCodeInfo && isAuthenticating && (
					<div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded">
						<div className="font-medium mb-3 text-blue-400">🔐 GitHub Authentication Required</div>
						<div className="space-y-3">
							<div>
								<div className="text-sm font-medium mb-1">1. Visit GitHub:</div>
								<div className="flex items-center gap-2">
									<VSCodeButtonLink
										href={deviceCodeInfo.verification_uri}
										appearance="primary"
										className="text-xs">
										Open GitHub
									</VSCodeButtonLink>
									<code className="text-xs bg-vscode-editor-background px-2 py-1 rounded border">
										{deviceCodeInfo.verification_uri}
									</code>
								</div>
							</div>
							<div>
								<div className="text-sm font-medium mb-1">2. Enter this code:</div>
								<div className="flex items-center gap-2">
									<code className="text-lg font-mono bg-vscode-editor-background px-3 py-2 rounded border border-vscode-focusBorder">
										{deviceCodeInfo.user_code}
									</code>
									<VSCodeButton
										appearance="secondary"
										className="text-xs"
										onClick={() => {
											navigator.clipboard.writeText(deviceCodeInfo.user_code)
										}}>
										Copy
									</VSCodeButton>
								</div>
							</div>
							<div className="text-xs text-vscode-descriptionForeground">
								⏱️ Code expires in {Math.floor(deviceCodeInfo.expires_in / 60)} minutes
							</div>
						</div>
					</div>
				)}

				{!isAuthenticated ? (
					<VSCodeButton onClick={handleAuthenticateClick} disabled={isAuthenticating} appearance="primary">
						{isAuthenticating
							? deviceCodeInfo
								? t("settings:providers.waitingForAuth") || "Waiting for authentication..."
								: t("settings:providers.authenticating")
							: t("settings:providers.authenticateWithGitHub")}
					</VSCodeButton>
				) : (
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<span className="text-sm text-green-500">✓</span>
							<span className="text-sm">{t("settings:providers.authenticated")}</span>
						</div>
						<VSCodeButton onClick={handleClearAuthClick} appearance="secondary">
							{t("settings:providers.clearAuthentication")}
						</VSCodeButton>
					</div>
				)}
			</div>

			{isAuthenticated && (
				<>
					{copilotModels && Object.keys(copilotModels).length > 0 ? (
						<ModelPicker
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							defaultModelId={copilotDefaultModelId}
							models={copilotModels}
							modelIdKey="copilotModelId"
							serviceName="Copilot"
							serviceUrl="https://github.com/features/copilot"
							organizationAllowList={organizationAllowList}
							errorMessage={modelValidationError}
						/>
					) : (
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:providers.copilotModelDescription")}
						</div>
					)}
					{modelValidationError && (
						<div className="text-sm text-vscode-errorForeground mt-2">{modelValidationError}</div>
					)}
				</>
			)}
		</>
	)
}
