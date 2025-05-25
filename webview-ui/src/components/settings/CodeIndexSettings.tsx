import React, { useState, useEffect } from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { Trans } from "react-i18next"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { VSCodeCheckbox, VSCodeTextField, VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@/utils/docLinks"
import { CodebaseIndexConfig, CodebaseIndexModels, ProviderSettings } from "../../../../src/schemas"
import { EmbedderProvider } from "../../../../src/shared/embeddingModels"
import { z } from "zod"

import { SetCachedStateField } from "./types"

interface CodeIndexSettingsProps {
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
	apiConfiguration: ProviderSettings
	setCachedStateField: SetCachedStateField<"codebaseIndexConfig">
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	areSettingsCommitted: boolean
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
		processedItems: number
		totalItems: number
		currentItemUnit?: string
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codebaseIndexModels,
	codebaseIndexConfig,
	apiConfiguration,
	setCachedStateField,
	setApiConfigurationField,
	areSettingsCommitted,
}) => {
	const { t } = useAppTranslation()
	const [indexingStatus, setIndexingStatus] = useState({
		systemStatus: "Standby",
		message: "",
		processedItems: 0,
		totalItems: 0,
		currentItemUnit: "items",
	})

	// Safely calculate available models for current provider
	const currentProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider
	const modelsForProvider =
		currentProvider === "openai" || currentProvider === "ollama"
			? codebaseIndexModels?.[currentProvider]
			: codebaseIndexModels?.openai
	const availableModelIds = Object.keys(modelsForProvider || {})

	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setIndexingStatus({
					systemStatus: event.data.values.systemStatus,
					message: event.data.values.message || "",
					processedItems: event.data.values.processedItems,
					totalItems: event.data.values.totalItems,
					currentItemUnit: event.data.values.currentItemUnit || "items",
				})
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [codebaseIndexConfig, codebaseIndexModels])

	function validateIndexingConfig(config: CodebaseIndexConfig | undefined, apiConfig: ProviderSettings): boolean {
		if (!config) return false

		const baseSchema = z.object({
			codebaseIndexQdrantUrl: z.string().url("Qdrant URL must be a valid URL"),
			codebaseIndexEmbedderModelId: z.string().min(1, "Model ID is required"),
		})

		const providerSchemas = {
			openai: baseSchema.extend({
				codebaseIndexEmbedderProvider: z.literal("openai"),
				codeIndexOpenAiKey: z.string().min(1, "OpenAI key is required"),
			}),
			ollama: baseSchema.extend({
				codebaseIndexEmbedderProvider: z.literal("ollama"),
				codebaseIndexEmbedderBaseUrl: z.string().url("Ollama URL must be a valid URL"),
			}),
		}

		try {
			const schema =
				config.codebaseIndexEmbedderProvider === "openai" ? providerSchemas.openai : providerSchemas.ollama

			schema.parse({
				...config,
				codeIndexOpenAiKey: apiConfig.codeIndexOpenAiKey,
			})
			return true
		} catch {
			return false
		}
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
				<div className="flex items-center gap-2">
					<VSCodeCheckbox
						checked={codebaseIndexConfig?.codebaseIndexEnabled}
						onChange={(e: any) =>
							setCachedStateField("codebaseIndexConfig", {
								...codebaseIndexConfig,
								codebaseIndexEnabled: e.target.checked,
							})
						}>
						<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-0">
					<Trans i18nKey="settings:codeIndex.enableDescription">
						<VSCodeLink
							href={buildDocLink("features/experimental/codebase-indexing", "settings")}
							style={{ display: "inline" }}></VSCodeLink>
					</Trans>
				</p>
			</div>

			{codebaseIndexConfig?.codebaseIndexEnabled && (
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
								value={codebaseIndexConfig?.codebaseIndexEmbedderProvider || "openai"}
								onValueChange={(value) => {
									const newProvider = value as EmbedderProvider
									// Don't reset modelId when provider changes, allow user to manage it explicitly
									if (codebaseIndexConfig) {
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderProvider: newProvider,
											// codebaseIndexEmbedderModelId: defaultModelId, // Removed this line
										})
									}
								}}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectProviderPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
									<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* OpenAI Specific Settings */}
					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai" && (
						<div className="flex flex-col gap-3">
							{/* OpenAI API Key */}
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									placeholder={t("settings:codeIndex.openaiKeyPlaceholder") || undefined}
									type="password"
									value={apiConfiguration.codeIndexOpenAiKey || ""}
									onInput={(e: any) => setApiConfigurationField("codeIndexOpenAiKey", e.target.value)}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
							{/* OpenAI Base URL */}
							<div className="flex items-center gap-4 font-bold">
								<div>
									{t("settings:codeIndex.openaiUrlLabel", {
										defaultValue: "OpenAI Base URL (Optional)",
									})}
								</div>
							</div>
							<div>
								<VSCodeTextField
									placeholder={
										t("settings:codeIndex.openaiUrlPlaceholder", {
											defaultValue: "e.g., https://my-proxy.com/v1 or Azure endpoint",
										}) || undefined
									}
									value={codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					{/* Ollama Specific Settings */}
					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "ollama" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.ollamaUrlLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									placeholder={
										t("settings:codeIndex.ollamaUrlPlaceholder", {
											defaultValue: "e.g., http://localhost:11434",
										}) || undefined
									}
									value={codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || ""}
									onInput={(e: any) =>
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderBaseUrl: e.target.value,
										})
									}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					{/* Model ID (Common to OpenAI/Ollama) */}
					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.modelLabel")}</div>
					</div>
					<div>
						<VSCodeTextField
							placeholder={
								t("settings:codeIndex.modelIdPlaceholder", {
									defaultValue: "Leave empty for default (e.g., text-embedding-3-small)",
								}) || undefined
							}
							value={codebaseIndexConfig?.codebaseIndexEmbedderModelId || ""}
							onInput={(e: any) =>
								setCachedStateField("codebaseIndexConfig", {
									...codebaseIndexConfig,
									codebaseIndexEmbedderModelId: e.target.value,
								})
							}
							style={{ width: "100%" }}></VSCodeTextField>
						<p className="text-xs text-vscode-descriptionForeground mt-1">
							{t("settings:codeIndex.modelIdDescription", {
								defaultValue: "Available models depend on your provider and configuration.",
							})}
							{currentProvider === "openai" && availableModelIds.length > 0 && (
								<>
									{" "}
									{t("settings:codeIndex.openaiDefaults", { defaultValue: "Defaults:" })}{" "}
									{availableModelIds.slice(0, 3).join(", ")}
									{availableModelIds.length > 3 ? "..." : ""}
								</>
							)}
							{currentProvider === "ollama" && availableModelIds.length > 0 && (
								<>
									{" "}
									{t("settings:codeIndex.ollamaDefaults", { defaultValue: "Common:" })}{" "}
									{availableModelIds.slice(0, 3).join(", ")}
									{availableModelIds.length > 3 ? "..." : ""}
								</>
							)}
						</p>
					</div>

					{/* Custom Model Dimension (Optional) */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>
								{t("settings:codeIndex.dimensionLabel", {
									defaultValue: "Custom Model Dimension (Optional)",
								})}
							</div>
						</div>
						<div>
							<VSCodeTextField
								type="text" // Use text type for HTML input
								placeholder={
									t("settings:codeIndex.dimensionPlaceholder", {
										defaultValue: "e.g., 1536. Only needed if model is not recognized.",
									}) || undefined
								}
								value={codebaseIndexConfig?.codebaseIndexEmbedderDimension?.toString() ?? ""} // Ensure value is string
								onInput={(e: any) => {
									const rawValue = e.target.value
									const parsedValue = parseInt(rawValue, 10)
									const dimensionToSave = !isNaN(parsedValue) && parsedValue > 0 ? parsedValue : null
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexEmbedderDimension: dimensionToSave,
									})
								}}
								style={{ width: "100%" }}></VSCodeTextField>
							<p className="text-xs text-vscode-descriptionForeground mt-1">
								{t("settings:codeIndex.dimensionDescription", {
									defaultValue:
										"Specify the embedding dimension only if using a custom model ID not listed in the defaults.",
								})}
							</p>
						</div>
					</div>

					{/* Qdrant Settings */}

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-4 font-bold">
							<div>{t("settings:codeIndex.qdrantUrlLabel")}</div>
						</div>
						<div>
							<VSCodeTextField
								value={codebaseIndexConfig.codebaseIndexQdrantUrl || "http://localhost:6333"}
								onInput={(e: any) =>
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexQdrantUrl: e.target.value,
									})
								}
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
								value={apiConfiguration.codeIndexQdrantApiKey}
								onInput={(e: any) => setApiConfigurationField("codeIndexQdrantApiKey", e.target.value)}
								style={{ width: "100%" }}></VSCodeTextField>
						</div>
					</div>

					{(!areSettingsCommitted || !validateIndexingConfig(codebaseIndexConfig, apiConfiguration)) && (
						<p className="text-sm text-vscode-descriptionForeground mb-2">
							{t("settings:codeIndex.unsavedSettingsMessage")}
						</p>
					)}

					<div className="flex gap-2">
						{(indexingStatus.systemStatus === "Error" || indexingStatus.systemStatus === "Standby") && (
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })}
								disabled={
									!areSettingsCommitted ||
									!validateIndexingConfig(codebaseIndexConfig, apiConfiguration)
								}>
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
				</div>
			)}
		</>
	)
}
