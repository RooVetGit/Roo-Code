import React, { useState, useCallback, useEffect } from "react"
import { VSCodeButton, VSCodeCheckbox, VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { CodebaseIndexConfig, CodebaseIndexModels } from "@roo-code/types"
import { EmbedderProvider } from "@roo/embeddingModels"
import { SEARCH_MIN_SCORE } from "../../../../src/services/code-index/constants"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Slider,
	Button,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@src/components/ui"

interface CodeIndexSettingsProps {
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
}

interface LocalCodeIndexSettings {
	// Global state settings
	codebaseIndexEnabled: boolean
	codebaseIndexQdrantUrl: string
	codebaseIndexEmbedderProvider: EmbedderProvider
	codebaseIndexEmbedderBaseUrl?: string
	codebaseIndexEmbedderModelId: string

	// Secret settings (start empty, will be loaded separately)
	codeIndexOpenAiKey?: string
	codeIndexQdrantApiKey?: string
	codebaseIndexOpenAiCompatibleBaseUrl?: string
	codebaseIndexOpenAiCompatibleApiKey?: string
	codebaseIndexOpenAiCompatibleModelDimension?: number
	codebaseIndexGeminiApiKey?: string
}

interface SecretStatus {
	hasOpenAiKey: boolean
	hasQdrantApiKey: boolean
	hasOpenAiCompatibleApiKey: boolean
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({ codebaseIndexModels, codebaseIndexConfig }) => {
	const { t } = useAppTranslation()
	const DEFAULT_QDRANT_URL = "http://localhost:6333"

	const [localSettings, setLocalSettings] = useState<LocalCodeIndexSettings>({
		// Global state settings
		codebaseIndexEnabled: codebaseIndexConfig?.codebaseIndexEnabled || false,
		codebaseIndexQdrantUrl: codebaseIndexConfig?.codebaseIndexQdrantUrl || DEFAULT_QDRANT_URL,
		codebaseIndexEmbedderProvider: codebaseIndexConfig?.codebaseIndexEmbedderProvider || "openai",
		codebaseIndexEmbedderBaseUrl: codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl || "",
		codebaseIndexEmbedderModelId: codebaseIndexConfig?.codebaseIndexEmbedderModelId || "",

		// Secret settings (start undefined to indicate no change)
		codeIndexOpenAiKey: undefined,
		codeIndexQdrantApiKey: undefined,
		codebaseIndexOpenAiCompatibleBaseUrl: "",
		codebaseIndexOpenAiCompatibleApiKey: undefined,
		codebaseIndexOpenAiCompatibleModelDimension: undefined,
		codebaseIndexGeminiApiKey: "",
	})

	const [secretStatus, setSecretStatus] = useState<SecretStatus>({
		hasOpenAiKey: false,
		hasQdrantApiKey: false,
		hasOpenAiCompatibleApiKey: false,
	})

	// Track which fields have been modified by the user
	const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set())

	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	const [indexingStatus, setIndexingStatus] = useState({
		systemStatus: "Standby",
		message: "",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})
	const [advancedExpanded, setAdvancedExpanded] = useState(false)

	// Update local settings when props change
	useEffect(() => {
		if (codebaseIndexConfig) {
			setLocalSettings((prev) => ({
				...prev,
				codebaseIndexEnabled: codebaseIndexConfig.codebaseIndexEnabled || false,
				codebaseIndexQdrantUrl: codebaseIndexConfig.codebaseIndexQdrantUrl || "http://localhost:6333",
				codebaseIndexEmbedderProvider: codebaseIndexConfig.codebaseIndexEmbedderProvider || "openai",
				codebaseIndexEmbedderBaseUrl: codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || "",
				codebaseIndexEmbedderModelId: codebaseIndexConfig.codebaseIndexEmbedderModelId || "",
			}))
		}
	}, [codebaseIndexConfig])

	// Listen for save response messages and indexing status updates
	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })
		// Request secret status
		vscode.postMessage({ type: "requestCodeIndexSecretStatus" })

		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "codeIndexSettingsSaved") {
				if (message.success) {
					setSaveStatus("success")
					setHasUnsavedChanges(false)
					// Clear success message after 3 seconds
					setTimeout(() => {
						setSaveStatus("idle")
					}, 3000)
					// Request updated secret status after save
					vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
				} else {
					setSaveStatus("error")
					// Clear error message after 5 seconds
					setTimeout(() => {
						setSaveStatus("idle")
					}, 5000)
				}
			} else if (message.type === "indexingStatusUpdate") {
				setIndexingStatus({
					systemStatus: message.values.systemStatus,
					message: message.values.message || "",
					processedItems: message.values.processedItems,
					totalItems: message.values.totalItems,
					currentItemUnit: message.values.currentItemUnit || "items",
				})
			} else if (message.type === "codeIndexSecretStatus") {
				setSecretStatus({
					hasOpenAiKey: message.values.hasOpenAiKey || false,
					hasQdrantApiKey: message.values.hasQdrantApiKey || false,
					hasOpenAiCompatibleApiKey: message.values.hasOpenAiCompatibleApiKey || false,
				})
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const updateSetting = useCallback((field: keyof LocalCodeIndexSettings, value: any) => {
		setLocalSettings((prev) => ({ ...prev, [field]: value }))
		setModifiedFields((prev) => new Set(prev).add(field))
		setHasUnsavedChanges(true)
		setSaveStatus("idle") // Reset any previous success/error status
	}, [])

	const saveSettings = useCallback(async () => {
		setSaveStatus("saving")
		setHasUnsavedChanges(false)

		// Only send fields that have been modified
		const settingsToSave: any = {
			// Always include non-secret settings
			codebaseIndexEnabled: localSettings.codebaseIndexEnabled,
			codebaseIndexQdrantUrl: localSettings.codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider: localSettings.codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl: localSettings.codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId: localSettings.codebaseIndexEmbedderModelId,
			codebaseIndexOpenAiCompatibleBaseUrl: localSettings.codebaseIndexOpenAiCompatibleBaseUrl,
			codebaseIndexOpenAiCompatibleModelDimension: localSettings.codebaseIndexOpenAiCompatibleModelDimension,
		}

		// Only include secret fields if they were modified
		if (modifiedFields.has("codeIndexOpenAiKey")) {
			settingsToSave.codeIndexOpenAiKey = localSettings.codeIndexOpenAiKey
		}
		if (modifiedFields.has("codeIndexQdrantApiKey")) {
			settingsToSave.codeIndexQdrantApiKey = localSettings.codeIndexQdrantApiKey
		}
		if (modifiedFields.has("codebaseIndexOpenAiCompatibleApiKey")) {
			settingsToSave.codebaseIndexOpenAiCompatibleApiKey = localSettings.codebaseIndexOpenAiCompatibleApiKey
		}

		vscode.postMessage({
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: settingsToSave,
		})

		// Clear modified fields after save
		setModifiedFields(new Set())
	}, [localSettings, modifiedFields])

	// Safely calculate available models for current provider
	const currentProvider = localSettings.codebaseIndexEmbedderProvider
	const modelsForProvider =
		currentProvider === "openai" || currentProvider === "ollama" || currentProvider === "openai-compatible" || currentProvider === "gemini"
			? codebaseIndexModels?.[currentProvider] || codebaseIndexModels?.openai
			: codebaseIndexModels?.openai
	const availableModelIds = Object.keys(modelsForProvider || {})

	/**
	 * Determines the appropriate model ID when changing providers
	 */
	function getModelIdForProvider(
		newProvider: EmbedderProvider,
		currentProvider: EmbedderProvider | undefined,
		currentModelId: string | undefined,
		availableModels: CodebaseIndexModels | undefined,
	): string {
		if (newProvider === currentProvider && currentModelId) {
			return currentModelId
		}

		const models = availableModels?.[newProvider]
		const modelIds = models ? Object.keys(models) : []

		if (currentModelId && modelIds.includes(currentModelId)) {
			return currentModelId
		}

		const selectedModel = modelIds.length > 0 ? modelIds[0] : ""
		return selectedModel
	}

	const handleProviderChange = (newProvider: EmbedderProvider) => {
		const modelIdToUse = getModelIdForProvider(
			newProvider,
			currentProvider,
			localSettings.codebaseIndexEmbedderModelId,
			codebaseIndexModels,
		)

		updateSetting("codebaseIndexEmbedderProvider", newProvider)
		updateSetting("codebaseIndexEmbedderModelId", modelIdToUse)
	}

	const progressPercentage =
		indexingStatus.totalItems > 0
			? (indexingStatus.processedItems / indexingStatus.totalItems) * 100
			: indexingStatus.totalItems === 0 && indexingStatus.processedItems === 0
				? 100
				: 0

	const transformValue = 100 - progressPercentage
	const transformStyleString = `translateX(-${transformValue}%)`

	return (
		<>
			<div>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<VSCodeCheckbox
							checked={localSettings.codebaseIndexEnabled}
							onChange={(e: any) => updateSetting("codebaseIndexEnabled", e.target.checked)}>
							<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
						</VSCodeCheckbox>
					</div>

					{/* Save Settings Section - Moved to top right */}
					<div className="flex gap-2 items-center">
						<VSCodeButton onClick={saveSettings} disabled={saveStatus === "saving" || !hasUnsavedChanges}>
							{saveStatus === "saving" ? "Saving..." : "Save Settings"}
						</VSCodeButton>

						{saveStatus === "success" && <span className="text-green-500">✓ Settings saved</span>}

						{saveStatus === "error" && <span className="text-red-500">✗ Failed to save</span>}

						{hasUnsavedChanges && saveStatus === "idle" && (
							<span className="text-yellow-500">• Unsaved changes</span>
						)}
					</div>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					<Trans i18nKey="settings:codeIndex.enableDescription">
						<VSCodeLink
							href={buildDocLink("features/experimental/codebase-indexing", "settings")}
							style={{ display: "inline" }}></VSCodeLink>
					</Trans>
				</p>
			</div>

			{localSettings.codebaseIndexEnabled && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div className="text-sm text-vscode-descriptionForeground">
						<span
							className={`
								inline-block w-3 h-3 rounded-full mr-2
								${
									indexingStatus.systemStatus === "Standby"
										? "bg-gray-400"
										: indexingStatus.systemStatus === "Indexing"
											? "bg-yellow-500 animate-pulse"
											: indexingStatus.systemStatus === "Indexed"
												? "bg-green-500"
												: indexingStatus.systemStatus === "Error"
													? "bg-red-500"
													: "bg-gray-400"
								}
							`}></span>
						{indexingStatus.systemStatus}
						{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
					</div>

					{indexingStatus.systemStatus === "Indexing" && (
						<div className="space-y-1">
							<ProgressPrimitive.Root
								className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
								value={progressPercentage}>
								<ProgressPrimitive.Indicator
									className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
									style={{
										transform: transformStyleString,
									}}
								/>
							</ProgressPrimitive.Root>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.providerLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Select
								value={localSettings.codebaseIndexEmbedderProvider}
								onValueChange={handleProviderChange}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectProviderPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
									<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
									<SelectItem value="openai-compatible">
										{t("settings:codeIndex.openaiCompatibleProvider")}
									</SelectItem>
									<SelectItem value="gemini">{t("settings:codeIndex.geminiProvider")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{localSettings.codebaseIndexEmbedderProvider === "openai" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={
										modifiedFields.has("codeIndexOpenAiKey")
											? localSettings.codeIndexOpenAiKey || ""
											: secretStatus.hasOpenAiKey
												? "••••••••••••••••"
												: ""
									}
									onInput={(e: any) => updateSetting("codeIndexOpenAiKey", e.target.value)}
									placeholder="Enter your OpenAI API key"
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiCompatibleBaseUrlLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									value={localSettings.codebaseIndexOpenAiCompatibleBaseUrl || ""}
									onInput={(e: any) =>
										updateSetting("codebaseIndexOpenAiCompatibleBaseUrl", e.target.value)
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiCompatibleApiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={
										modifiedFields.has("codebaseIndexOpenAiCompatibleApiKey")
											? localSettings.codebaseIndexOpenAiCompatibleApiKey || ""
											: secretStatus.hasOpenAiCompatibleApiKey
												? "••••••••••••••••"
												: ""
									}
									onInput={(e: any) =>
										updateSetting("codebaseIndexOpenAiCompatibleApiKey", e.target.value)
									}
									placeholder="Enter your API key"
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.modelLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							{localSettings.codebaseIndexEmbedderProvider === "openai-compatible" ? (
								<VSCodeTextField
									value={localSettings.codebaseIndexEmbedderModelId || ""}
									onInput={(e: any) => updateSetting("codebaseIndexEmbedderModelId", e.target.value)}
									placeholder="Enter custom model ID"
									style={{ width: "100%" }}></VSCodeTextField>
							) : (
								<Select
									value={localSettings.codebaseIndexEmbedderModelId || ""}
									onValueChange={(value) => updateSetting("codebaseIndexEmbedderModelId", value)}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("settings:codeIndex.selectModelPlaceholder")} />
									</SelectTrigger>
									<SelectContent>
										{availableModelIds.map((modelId) => (
											<SelectItem key={modelId} value={modelId}>
												{modelId}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					</div>

					{localSettings.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiCompatibleModelDimensionLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="text"
									value={localSettings.codebaseIndexOpenAiCompatibleModelDimension?.toString() || ""}
									onInput={(e: any) => {
										const value = e.target.value
										if (value === "") {
											updateSetting("codebaseIndexOpenAiCompatibleModelDimension", undefined)
										} else {
											const parsedValue = parseInt(value, 10)
											if (!isNaN(parsedValue)) {
												updateSetting(
													"codebaseIndexOpenAiCompatibleModelDimension",
													parsedValue,
												)
											}
										}
									}}
									placeholder={t("settings:codeIndex.openaiCompatibleModelDimensionPlaceholder")}
									style={{ width: "100%" }}></VSCodeTextField>
								<p className="text-vscode-descriptionForeground text-sm mt-1">
									{t("settings:codeIndex.openaiCompatibleModelDimensionDescription")}
								</p>
							</div>
						</div>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "ollama" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.ollamaUrlLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									value={localSettings.codebaseIndexEmbedderBaseUrl || ""}
									onInput={(e: any) => updateSetting("codebaseIndexEmbedderBaseUrl", e.target.value)}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "gemini" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.geminiApiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={localSettings.codebaseIndexGeminiApiKey || ""}
									onInput={(e: any) =>
										updateSetting("codebaseIndexGeminiApiKey", e.target.value)
									}
									placeholder={
										localSettings.codebaseIndexGeminiApiKey
											? "••••••••••••••••"
											: t("settings:codeIndex.geminiApiKeyPlaceholder")
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>{t("settings:codeIndex.qdrantUrlLabel")}</div>
						</div>
						<div>
							<VSCodeTextField
								value={localSettings.codebaseIndexQdrantUrl}
								placeholder={DEFAULT_QDRANT_URL}
								onInput={(e: any) => updateSetting("codebaseIndexQdrantUrl", e.target.value)}
								onBlur={(e: any) => {
									// Set default value if field is empty on blur
									if (!e.target.value) {
										updateSetting("codebaseIndexQdrantUrl", DEFAULT_QDRANT_URL)
									}
								}}
								style={{ width: "100%" }}></VSCodeTextField>
						</div>
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>{t("settings:codeIndex.qdrantKeyLabel")}</div>
						</div>
						<div>
							<VSCodeTextField
								type="password"
								value={
									modifiedFields.has("codeIndexQdrantApiKey")
										? localSettings.codeIndexQdrantApiKey || ""
										: secretStatus.hasQdrantApiKey
											? "••••••••••••••••"
											: ""
								}
								onInput={(e: any) => updateSetting("codeIndexQdrantApiKey", e.target.value)}
								placeholder="Enter your Qdrant API key (optional)"
								style={{ width: "100%" }}></VSCodeTextField>
						</div>
					</div>

					<div className="flex gap-2">
						{(indexingStatus.systemStatus === "Error" || indexingStatus.systemStatus === "Standby") && (
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })}
								disabled={saveStatus === "saving" || hasUnsavedChanges}>
								{t("settings:codeIndex.startIndexingButton")}
							</VSCodeButton>
						)}
						{(indexingStatus.systemStatus === "Indexed" || indexingStatus.systemStatus === "Error") && (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										{t("settings:codeIndex.clearIndexDataButton")}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t("settings:codeIndex.clearDataDialog.title")}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{t("settings:codeIndex.clearDataDialog.description")}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											{t("settings:codeIndex.clearDataDialog.cancelButton")}
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
											{t("settings:codeIndex.clearDataDialog.confirmButton")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
					</div>

					{hasUnsavedChanges && (
						<p className="text-sm text-vscode-descriptionForeground mb-2">
							{t("settings:codeIndex.unsavedSettingsMessage")}
						</p>
					)}
				</div>
			)}
		</>
	)
}
