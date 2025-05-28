import React, { useState, useEffect } from "react"
import { z } from "zod"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"

import { CodebaseIndexConfig, CodebaseIndexModels, ProviderSettings } from "@roo-code/types"

import { EmbedderProvider, EMBEDDING_MODEL_PROFILES } from "@roo/embeddingModels"

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
} from "@src/components/ui"

import { SetCachedStateField } from "./types"
import { RateLimitSecondsControl } from "./RateLimitSecondsControl"

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
		currentProvider === "openai" || currentProvider === "ollama" || currentProvider === "gemini"
			? codebaseIndexModels?.[currentProvider]
			: codebaseIndexModels?.openai
	const availableModelIds = Object.keys(modelsForProvider || {})

	// Logic for Gemini dimension selector
	const selectedModelIdForGeminiDim = codebaseIndexConfig?.codebaseIndexEmbedderModelId
	const geminiModelProfileForDim =
		currentProvider === "gemini" && selectedModelIdForGeminiDim
			? EMBEDDING_MODEL_PROFILES.gemini?.[selectedModelIdForGeminiDim]
			: undefined
	const geminiSupportedDims = geminiModelProfileForDim?.supportDimensions

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
			gemini: baseSchema.extend({
				codebaseIndexEmbedderProvider: z.literal("gemini"),
				geminiApiKey: z.string().min(1, "Gemini API key is required"),
				geminiEmbeddingTaskType: z.string().min(1, "Gemini Task Type is required"),
				geminiEmbeddingDimension: z
					.number()
					.int()
					.positive("Embedding dimension must be a positive integer")
					.optional(),
			}),
		}

		try {
			const schema =
				config.codebaseIndexEmbedderProvider === "openai"
					? providerSchemas.openai
					: config.codebaseIndexEmbedderProvider === "ollama"
						? providerSchemas.ollama
						: providerSchemas.gemini

			schema.parse({
				...config,
				codeIndexOpenAiKey: apiConfig.codeIndexOpenAiKey,
				geminiApiKey: apiConfig.geminiApiKey,
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
									const currentProvider = codebaseIndexConfig?.codebaseIndexEmbedderProvider
									const currentModelId = codebaseIndexConfig?.codebaseIndexEmbedderModelId

									const modelIdToUse = getModelIdForProvider(
										newProvider,
										currentProvider,
										currentModelId,
										codebaseIndexModels,
									)

									if (codebaseIndexConfig) {
										setCachedStateField("codebaseIndexConfig", {
											...codebaseIndexConfig,
											codebaseIndexEmbedderProvider: newProvider,
											codebaseIndexEmbedderModelId: modelIdToUse,
										})
									}
								}}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("settings:codeIndex.selectProviderPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="openai">{t("settings:codeIndex.openaiProvider")}</SelectItem>
									<SelectItem value="ollama">{t("settings:codeIndex.ollamaProvider")}</SelectItem>
									<SelectItem value="gemini">{t("settings:codeIndex.geminiProvider")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "openai" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.openaiKeyLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
									type="password"
									value={apiConfiguration.codeIndexOpenAiKey || ""}
									onInput={(e: any) => setApiConfigurationField("codeIndexOpenAiKey", e.target.value)}
									style={{ width: "100%" }}></VSCodeTextField>
							</div>
						</div>
					)}

					<div className="flex items-center gap-4 font-bold">
						<div>{t("settings:codeIndex.modelLabel")}</div>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Select
								value={codebaseIndexConfig?.codebaseIndexEmbedderModelId || ""}
								onValueChange={(value) =>
									setCachedStateField("codebaseIndexConfig", {
										...codebaseIndexConfig,
										codebaseIndexEmbedderModelId: value,
									})
								}>
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
						</div>
					</div>

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "ollama" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-4 font-bold">
								<div>{t("settings:codeIndex.ollamaUrlLabel")}</div>
							</div>
							<div>
								<VSCodeTextField
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

					{codebaseIndexConfig?.codebaseIndexEmbedderProvider === "gemini" && (
						<>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-4 font-bold">
									<div>{t("settings:codeIndex.geminiApiKey")}</div>
								</div>
								<div>
									<VSCodeTextField
										type="password"
										value={apiConfiguration.geminiApiKey || ""}
										onInput={(e: any) => setApiConfigurationField("geminiApiKey", e.target.value)}
										placeholder={t("settings:codeIndex.apiKeyPlaceholder")}
										style={{ width: "100%" }}></VSCodeTextField>
								</div>
							</div>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-4 font-bold">
									<div>{t("settings:codeIndex.embeddingTaskType")}</div>
								</div>
								<div>
									<div className="flex items-center gap-2">
										<Select
											value={
												codebaseIndexConfig?.geminiEmbeddingTaskType || "CODE_RETRIEVAL_QUERY"
											}
											onValueChange={(value) =>
												setCachedStateField("codebaseIndexConfig", {
													...codebaseIndexConfig,
													geminiEmbeddingTaskType: value,
												})
											}>
											<SelectTrigger className="w-full">
												<SelectValue
													placeholder={t("settings:codeIndex.selectTaskTypePlaceholder")}
												/>
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="CODE_RETRIEVAL_QUERY">
													{t("settings:codeIndex.selectTaskType.codeRetrievalQuery")}
												</SelectItem>
												<SelectItem value="RETRIEVAL_DOCUMENT">
													{t("settings:codeIndex.selectTaskType.retrievalDocument")}
												</SelectItem>
												<SelectItem value="RETRIEVAL_QUERY">
													{t("settings:codeIndex.selectTaskType.retrievalQuery")}
												</SelectItem>
												<SelectItem value="SEMANTIC_SIMILARITY">
													{t("settings:codeIndex.selectTaskType.semanticSimilarity")}
												</SelectItem>
												<SelectItem value="CLASSIFICATION">
													{t("settings:codeIndex.selectTaskType.classification")}
												</SelectItem>
												<SelectItem value="CLUSTERING">
													{t("settings:codeIndex.selectTaskType.clustering")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>
							{currentProvider === "gemini" &&
								geminiModelProfileForDim &&
								geminiSupportedDims &&
								geminiSupportedDims.length > 0 && (
									<div className="flex flex-col gap-3">
										<div className="flex items-center gap-4 font-bold">
											<div>{t("settings:codeIndex.embeddingDimension")}</div>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<Select
													value={codebaseIndexConfig?.geminiEmbeddingDimension?.toString()}
													onValueChange={(dimStr) => {
														const newDim = parseInt(dimStr, 10)
														if (!isNaN(newDim)) {
															setCachedStateField("codebaseIndexConfig", {
																...codebaseIndexConfig,
																geminiEmbeddingDimension: newDim,
															})
														}
													}}>
													<SelectTrigger className="w-full">
														<SelectValue
															placeholder={t(
																"settings:codeIndex.selectDimensionPlaceholder",
															)}
														/>
													</SelectTrigger>
													<SelectContent>
														{geminiSupportedDims.map((dim) => (
															<SelectItem key={dim} value={dim.toString()}>
																{dim}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>
									</div>
								)}
							<div className="flex flex-col gap-3">
								<RateLimitSecondsControl
									value={apiConfiguration.rateLimitSeconds || 0}
									onChange={(value) => setApiConfigurationField("rateLimitSeconds", value)}
								/>
							</div>
						</>
					)}

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
