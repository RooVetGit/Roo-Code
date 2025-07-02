import React, { useState, useEffect, useMemo } from "react"
import { Trans } from "react-i18next"
import {
	VSCodeButton,
	VSCodeTextField,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeLink,
} from "@vscode/webview-ui-toolkit/react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"
import { cn } from "@src/lib/utils"
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@src/components/ui"
import type { EmbedderProvider } from "@roo/embeddingModels"
import type { IndexingStatus } from "@roo/ExtensionMessage"

interface CodeIndexPopoverProps {
	children: React.ReactNode
	indexingStatus: IndexingStatus
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

export const CodeIndexPopover: React.FC<CodeIndexPopoverProps> = ({
	children,
	indexingStatus: externalIndexingStatus,
}) => {
	const { t } = useAppTranslation()
	const { codebaseIndexConfig, codebaseIndexModels } = useExtensionState()
	const [open, setOpen] = useState(false)

	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>(externalIndexingStatus)

	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
	const [saveError, setSaveError] = useState<string | null>(null)

	// Track which fields have been modified by the user
	const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set())

	// Local state for all settings
	const [localSettings, setLocalSettings] = useState<LocalCodeIndexSettings>({
		codebaseIndexEnabled: false,
		codebaseIndexQdrantUrl: "",
		codebaseIndexEmbedderProvider: "openai",
		codebaseIndexEmbedderBaseUrl: "",
		codebaseIndexEmbedderModelId: "",
		codeIndexOpenAiKey: "",
		codeIndexQdrantApiKey: "",
		codebaseIndexOpenAiCompatibleBaseUrl: "",
		codebaseIndexOpenAiCompatibleApiKey: "",
		codebaseIndexOpenAiCompatibleModelDimension: undefined,
		codebaseIndexGeminiApiKey: "",
	})

	// Update indexing status from parent
	useEffect(() => {
		setIndexingStatus(externalIndexingStatus)
	}, [externalIndexingStatus])

	// Initialize local settings from global state
	useEffect(() => {
		if (codebaseIndexConfig) {
			setLocalSettings((prev) => ({
				...prev,
				codebaseIndexEnabled: codebaseIndexConfig.codebaseIndexEnabled || false,
				codebaseIndexQdrantUrl: codebaseIndexConfig.codebaseIndexQdrantUrl || "",
				codebaseIndexEmbedderProvider: codebaseIndexConfig.codebaseIndexEmbedderProvider || "openai",
				codebaseIndexEmbedderBaseUrl: codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || "",
				codebaseIndexEmbedderModelId: codebaseIndexConfig.codebaseIndexEmbedderModelId || "",
			}))
		}
	}, [codebaseIndexConfig])

	// Request initial indexing status
	useEffect(() => {
		if (open) {
			vscode.postMessage({ type: "requestIndexingStatus" })
			vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
		}
	}, [open])

	// Listen for indexing status updates and save responses
	useEffect(() => {
		const handleMessage = (event: MessageEvent<any>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setIndexingStatus({
					systemStatus: event.data.values.systemStatus,
					message: event.data.values.message || "",
					processedItems: event.data.values.processedItems,
					totalItems: event.data.values.totalItems,
					currentItemUnit: event.data.values.currentItemUnit || "items",
				})
			} else if (event.data.type === "codeIndexSettingsSaved") {
				if (event.data.success) {
					setSaveStatus("saved")
					setHasUnsavedChanges(false)
					// Clear modified fields after successful save
					setModifiedFields(new Set())
					// Request updated secret status after save
					vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
					// Reset status after 3 seconds
					setTimeout(() => {
						setSaveStatus("idle")
					}, 3000)
				} else {
					setSaveStatus("error")
					setSaveError(event.data.error || t("settings:codeIndex.saveError"))
					// Clear error message after 5 seconds
					setTimeout(() => {
						setSaveStatus("idle")
						setSaveError(null)
					}, 5000)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t])

	// Listen for secret status
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "codeIndexSecretStatus") {
				// Update local settings to show placeholders for existing secrets
				// Only update if the field hasn't been modified by the user
				setLocalSettings((prev) => ({
					...prev,
					codeIndexOpenAiKey:
						!modifiedFields.has("codeIndexOpenAiKey") && event.data.values.hasOpenAiKey
							? "••••••••••••••••"
							: prev.codeIndexOpenAiKey,
					codeIndexQdrantApiKey:
						!modifiedFields.has("codeIndexQdrantApiKey") && event.data.values.hasQdrantApiKey
							? "••••••••••••••••"
							: prev.codeIndexQdrantApiKey,
					codebaseIndexOpenAiCompatibleApiKey:
						!modifiedFields.has("codebaseIndexOpenAiCompatibleApiKey") &&
						event.data.values.hasOpenAiCompatibleApiKey
							? "••••••••••••••••"
							: prev.codebaseIndexOpenAiCompatibleApiKey,
					codebaseIndexGeminiApiKey:
						!modifiedFields.has("codebaseIndexGeminiApiKey") && event.data.values.hasGeminiApiKey
							? "••••••••••••••••"
							: prev.codebaseIndexGeminiApiKey,
				}))
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [modifiedFields])

	// Track changes
	useEffect(() => {
		if (!codebaseIndexConfig) return

		const hasChanges =
			localSettings.codebaseIndexEnabled !== codebaseIndexConfig.codebaseIndexEnabled ||
			localSettings.codebaseIndexQdrantUrl !== (codebaseIndexConfig.codebaseIndexQdrantUrl || "") ||
			localSettings.codebaseIndexEmbedderProvider !==
				(codebaseIndexConfig.codebaseIndexEmbedderProvider || "openai") ||
			localSettings.codebaseIndexEmbedderBaseUrl !== (codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || "") ||
			localSettings.codebaseIndexEmbedderModelId !== (codebaseIndexConfig.codebaseIndexEmbedderModelId || "")

		setHasUnsavedChanges(hasChanges)
	}, [localSettings, codebaseIndexConfig])

	const updateLocalSetting = (key: keyof LocalCodeIndexSettings, value: any) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }))
		// Mark field as modified when user changes it
		if (
			key === "codeIndexOpenAiKey" ||
			key === "codeIndexQdrantApiKey" ||
			key === "codebaseIndexOpenAiCompatibleApiKey" ||
			key === "codebaseIndexGeminiApiKey"
		) {
			setModifiedFields((prev) => new Set(prev).add(key))
		}
	}

	const handleSaveSettings = () => {
		setSaveStatus("saving")
		setSaveError(null)

		// Prepare settings to save
		const settingsToSave: any = {
			codebaseIndexEnabled: localSettings.codebaseIndexEnabled,
			codebaseIndexQdrantUrl: localSettings.codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider: localSettings.codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl: localSettings.codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId: localSettings.codebaseIndexEmbedderModelId,
			codebaseIndexOpenAiCompatibleBaseUrl: localSettings.codebaseIndexOpenAiCompatibleBaseUrl,
			codebaseIndexOpenAiCompatibleModelDimension: localSettings.codebaseIndexOpenAiCompatibleModelDimension,
		}

		// Only include secret fields if they've been modified (not showing placeholder)
		if (modifiedFields.has("codeIndexOpenAiKey") && localSettings.codeIndexOpenAiKey !== "••••••••••••••••") {
			settingsToSave.codeIndexOpenAiKey = localSettings.codeIndexOpenAiKey
		}
		if (modifiedFields.has("codeIndexQdrantApiKey") && localSettings.codeIndexQdrantApiKey !== "••••••••••••••••") {
			settingsToSave.codeIndexQdrantApiKey = localSettings.codeIndexQdrantApiKey
		}
		if (
			modifiedFields.has("codebaseIndexOpenAiCompatibleApiKey") &&
			localSettings.codebaseIndexOpenAiCompatibleApiKey !== "••••••••••••••••"
		) {
			settingsToSave.codebaseIndexOpenAiCompatibleApiKey = localSettings.codebaseIndexOpenAiCompatibleApiKey
		}
		if (modifiedFields.has("codebaseIndexGeminiApiKey") && localSettings.codebaseIndexGeminiApiKey !== "••••••••••••••••") {
			settingsToSave.codebaseIndexGeminiApiKey = localSettings.codebaseIndexGeminiApiKey
		}

		// Save settings to backend
		vscode.postMessage({
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: settingsToSave,
		})
	}

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	const transformStyleString = `translateX(-${100 - progressPercentage}%)`

	const getAvailableModels = () => {
		if (!codebaseIndexModels) return []

		const models = codebaseIndexModels[localSettings.codebaseIndexEmbedderProvider]
		return models ? Object.keys(models) : []
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className="w-[calc(100vw-32px)] max-w-[450px] max-h-[80vh] overflow-y-auto p-4"
				align="end"
				alignOffset={0}
				side="bottom"
				sideOffset={5}
				collisionPadding={16}
				avoidCollisions={true}>
				<div className="mb-4">
					<h3 className="text-base font-medium mb-2">{t("settings:codeIndex.title")}</h3>
					<p className="text-sm text-vscode-descriptionForeground">
						<Trans i18nKey="settings:codeIndex.description">
							<VSCodeLink
								href={buildDocLink("features/experimental/codebase-indexing", "settings")}
								style={{ display: "inline" }}
							/>
						</Trans>
					</p>
				</div>

				<div className="space-y-4">
					{/* Status Section */}
					<div className="space-y-2">
						<h4 className="text-sm font-medium">{t("settings:codeIndex.statusTitle")}</h4>
						<div className="text-sm text-vscode-descriptionForeground">
							<span
								className={cn("inline-block w-3 h-3 rounded-full mr-2", {
									"bg-gray-400": indexingStatus.systemStatus === "Standby",
									"bg-yellow-500 animate-pulse": indexingStatus.systemStatus === "Indexing",
									"bg-green-500": indexingStatus.systemStatus === "Indexed",
									"bg-red-500": indexingStatus.systemStatus === "Error",
								})}
							/>
							{t(`settings:codeIndex.indexingStatuses.${indexingStatus.systemStatus.toLowerCase()}`)}
							{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
						</div>

						{indexingStatus.systemStatus === "Indexing" && (
							<div className="mt-2">
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
					</div>

					{/* Embedder Provider Section */}
					<div className="space-y-2">
						<label className="text-sm font-medium">{t("settings:codeIndex.embedderProviderLabel")}</label>
						<Select
							value={localSettings.codebaseIndexEmbedderProvider}
							onValueChange={(value: EmbedderProvider) =>
								updateLocalSetting("codebaseIndexEmbedderProvider", value)
							}>
							<SelectTrigger className="w-full">
								<SelectValue />
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

					{/* Provider-specific settings */}
					{localSettings.codebaseIndexEmbedderProvider === "openai" && (
						<>
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.openAiKeyLabel")}</label>
								<VSCodeTextField
									type="password"
									value={localSettings.codeIndexOpenAiKey || ""}
									onInput={(e: any) => updateLocalSetting("codeIndexOpenAiKey", e.target.value)}
									placeholder={t("settings:codeIndex.openAiKeyPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={localSettings.codebaseIndexEmbedderModelId}
									onChange={(e: any) =>
										updateLocalSetting("codebaseIndexEmbedderModelId", e.target.value)
									}
									className="w-full">
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.[localSettings.codebaseIndexEmbedderProvider]?.[
												modelId
											]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</div>
						</>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "ollama" && (
						<>
							<div className="space-y-2">
								<label className="text-sm font-medium">
									{t("settings:codeIndex.ollamaBaseUrlLabel")}
								</label>
								<VSCodeTextField
									value={localSettings.codebaseIndexEmbedderBaseUrl || ""}
									onInput={(e: any) =>
										updateLocalSetting("codebaseIndexEmbedderBaseUrl", e.target.value)
									}
									placeholder={t("settings:codeIndex.ollamaUrlPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={localSettings.codebaseIndexEmbedderModelId}
									onChange={(e: any) =>
										updateLocalSetting("codebaseIndexEmbedderModelId", e.target.value)
									}
									className="w-full">
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.[localSettings.codebaseIndexEmbedderProvider]?.[
												modelId
											]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</div>
						</>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "openai-compatible" && (
						<>
							<div className="space-y-2">
								<label className="text-sm font-medium">
									{t("settings:codeIndex.openAiCompatibleBaseUrlLabel")}
								</label>
								<VSCodeTextField
									value={localSettings.codebaseIndexOpenAiCompatibleBaseUrl || ""}
									onInput={(e: any) =>
										updateLocalSetting("codebaseIndexOpenAiCompatibleBaseUrl", e.target.value)
									}
									placeholder={t("settings:codeIndex.openAiCompatibleBaseUrlPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">
									{t("settings:codeIndex.openAiCompatibleApiKeyLabel")}
								</label>
								<VSCodeTextField
									type="password"
									value={localSettings.codebaseIndexOpenAiCompatibleApiKey || ""}
									onInput={(e: any) =>
										updateLocalSetting("codebaseIndexOpenAiCompatibleApiKey", e.target.value)
									}
									placeholder={t("settings:codeIndex.openAiCompatibleApiKeyPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeTextField
									value={localSettings.codebaseIndexEmbedderModelId || ""}
									onInput={(e: any) =>
										updateLocalSetting("codebaseIndexEmbedderModelId", e.target.value)
									}
									placeholder={t("settings:codeIndex.modelPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">
									{t("settings:codeIndex.modelDimensionLabel")}
								</label>
								<VSCodeTextField
									value={localSettings.codebaseIndexOpenAiCompatibleModelDimension?.toString() || ""}
									onInput={(e: any) => {
										const value = e.target.value ? parseInt(e.target.value) : undefined
										updateLocalSetting("codebaseIndexOpenAiCompatibleModelDimension", value)
									}}
									placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
									className="w-full"
								/>
							</div>
						</>
					)}

					{localSettings.codebaseIndexEmbedderProvider === "gemini" && (
						<>
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.geminiApiKeyLabel")}</label>
								<VSCodeTextField
									type="password"
									value={localSettings.codebaseIndexGeminiApiKey || ""}
									onInput={(e: any) => updateLocalSetting("codebaseIndexGeminiApiKey", e.target.value)}
									placeholder={t("settings:codeIndex.geminiApiKeyPlaceholder")}
									className="w-full"
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">{t("settings:codeIndex.modelLabel")}</label>
								<VSCodeDropdown
									value={localSettings.codebaseIndexEmbedderModelId}
									onChange={(e: any) =>
										updateLocalSetting("codebaseIndexEmbedderModelId", e.target.value)
									}
									className="w-full">
									<VSCodeOption value="">{t("settings:codeIndex.selectModel")}</VSCodeOption>
									{getAvailableModels().map((modelId) => {
										const model =
											codebaseIndexModels?.[localSettings.codebaseIndexEmbedderProvider]?.[
												modelId
											]
										return (
											<VSCodeOption key={modelId} value={modelId}>
												{modelId}{" "}
												{model
													? t("settings:codeIndex.modelDimensions", {
															dimension: model.dimension,
														})
													: ""}
											</VSCodeOption>
										)
									})}
								</VSCodeDropdown>
							</div>
						</>
					)}

					{/* Qdrant Settings */}
					<div className="space-y-2">
						<label className="text-sm font-medium">{t("settings:codeIndex.qdrantUrlLabel")}</label>
						<VSCodeTextField
							value={localSettings.codebaseIndexQdrantUrl || ""}
							onInput={(e: any) => updateLocalSetting("codebaseIndexQdrantUrl", e.target.value)}
							placeholder={t("settings:codeIndex.qdrantUrlPlaceholder")}
							className="w-full"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium">{t("settings:codeIndex.qdrantApiKeyLabel")}</label>
						<VSCodeTextField
							type="password"
							value={localSettings.codeIndexQdrantApiKey || ""}
							onInput={(e: any) => updateLocalSetting("codeIndexQdrantApiKey", e.target.value)}
							placeholder={t("settings:codeIndex.qdrantApiKeyPlaceholder")}
							className="w-full"
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center justify-between gap-2 pt-2">
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

						<VSCodeButton
							onClick={handleSaveSettings}
							disabled={!hasUnsavedChanges || saveStatus === "saving"}>
							{saveStatus === "saving"
								? t("settings:codeIndex.saving")
								: t("settings:codeIndex.saveSettings")}
						</VSCodeButton>
					</div>

					{/* Save Status Messages */}
					{saveStatus === "error" && (
						<div className="mt-2">
							<span className="text-sm text-red-600 block">
								{saveError || t("settings:codeIndex.saveError")}
							</span>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
