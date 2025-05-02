import React, { useState, useCallback, useEffect } from "react" // Added useState, useCallback, useEffect
import { VSCodeButton, VSCodeTextArea, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react" // Added VSCodeTextArea, VSCodeDropdown, VSCodeOption
import { useTranslation } from "react-i18next"
import { TabHeader } from "../common/Tab" // Import TabHeader
import { Button } from "@/components/ui/button" // Added Button import
import { useExtensionState } from "@src/context/ExtensionStateContext" // Added context import
import { supportPrompt, SupportPromptType } from "@roo/shared/support-prompt" // Added support prompt utils
import { vscode } from "@src/utils/vscode" // Added vscode utils

interface SupportPromptsViewProps {
	onDone: () => void
}

export const SupportPromptsView: React.FC<SupportPromptsViewProps> = ({ onDone }) => {
	const { t } = useTranslation(["prompts", "common"])
	const { customSupportPrompts, listApiConfigMeta, enhancementApiConfigId, setEnhancementApiConfigId } =
		useExtensionState() // Get state from context

	// State for the view
	const [activeSupportTab, setActiveSupportTab] = useState<SupportPromptType>("ENHANCE")
	const [testPrompt, setTestPrompt] = useState("")
	const [isEnhancing, setIsEnhancing] = useState(false)

	// Helper functions (adapted from PromptsView)
	const updateSupportPrompt = useCallback((type: SupportPromptType, value: string | undefined) => {
		vscode.postMessage({
			type: "updateSupportPrompt",
			values: {
				[type]: value,
			},
		})
	}, [])

	const handleSupportReset = useCallback((type: SupportPromptType) => {
		vscode.postMessage({
			type: "resetSupportPrompt",
			text: type,
		})
	}, [])

	const getSupportPromptValue = useCallback(
		(type: SupportPromptType): string => {
			return supportPrompt.get(customSupportPrompts, type)
		},
		[customSupportPrompts],
	)

	const handleTestEnhancement = useCallback(() => {
		if (!testPrompt.trim()) return

		setIsEnhancing(true)
		vscode.postMessage({
			type: "enhancePrompt",
			text: testPrompt,
		})
	}, [testPrompt])

	// Listen for enhanced prompt results
	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "enhancedPrompt") {
				if (message.text) {
					setTestPrompt(message.text)
				}
				setIsEnhancing(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	return (
		<div className="flex flex-col h-full p-4">
			<TabHeader className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("prompts:supportPrompts.title")}</h3>
				<VSCodeButton onClick={onDone}>{t("common:buttons.done")}</VSCodeButton>
			</TabHeader>
			<div className="flex-grow overflow-y-auto mt-4">
				{/* START: Content migrated from PromptsView */}
				<div
					style={{
						marginTop: "20px",
						paddingBottom: "60px",
						borderBottom: "1px solid var(--vscode-input-border)",
					}}>
					{/* Removed h3 title as it's now in TabHeader */}
					<div
						style={{
							display: "flex",
							gap: "8px",
							alignItems: "center",
							marginBottom: "12px",
							flexWrap: "wrap",
							padding: "4px 0",
						}}>
						{Object.keys(supportPrompt.default).map((type) => (
							<button
								key={type}
								data-testid={`${type}-tab`}
								data-active={activeSupportTab === type ? "true" : "false"}
								onClick={() => setActiveSupportTab(type as SupportPromptType)}
								style={{
									padding: "4px 8px",
									border: "none",
									background: activeSupportTab === type ? "var(--vscode-button-background)" : "none",
									color:
										activeSupportTab === type
											? "var(--vscode-button-foreground)"
											: "var(--vscode-foreground)",
									cursor: "pointer",
									opacity: activeSupportTab === type ? 1 : 0.8,
									borderRadius: "3px",
									fontWeight: "bold",
								}}>
								{t(`prompts:supportPrompts.types.${type}.label`)}
							</button>
						))}
					</div>

					{/* Support prompt description */}
					<div
						style={{
							fontSize: "13px",
							color: "var(--vscode-descriptionForeground)",
							margin: "8px 0 16px",
						}}>
						{t(`prompts:supportPrompts.types.${activeSupportTab}.description`)}
					</div>

					{/* Show active tab content */}
					<div key={activeSupportTab}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "4px",
							}}>
							<div style={{ fontWeight: "bold" }}>{t("prompts:supportPrompts.prompt")}</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleSupportReset(activeSupportTab)}
								title={t("prompts:supportPrompts.resetPrompt", { promptType: activeSupportTab })}>
								<span className="codicon codicon-discard"></span>
							</Button>
						</div>

						<VSCodeTextArea
							value={getSupportPromptValue(activeSupportTab)}
							onChange={(e) => {
								const value =
									(e as CustomEvent)?.detail?.target?.value ||
									((e as any).target as HTMLTextAreaElement).value
								const trimmedValue = value.trim()
								updateSupportPrompt(activeSupportTab, trimmedValue || undefined)
							}}
							rows={6}
							resize="vertical"
							style={{ width: "100%" }}
						/>

						{activeSupportTab === "ENHANCE" && (
							<>
								<div>
									<div
										style={{
											color: "var(--vscode-foreground)",
											fontSize: "13px",
											marginBottom: "20px",
											marginTop: "5px",
										}}></div>
									<div style={{ marginBottom: "12px" }}>
										<div style={{ marginBottom: "8px" }}>
											<div style={{ fontWeight: "bold", marginBottom: "4px" }}>
												{t("prompts:supportPrompts.enhance.apiConfiguration")}
											</div>
											<div
												style={{
													fontSize: "13px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												{t("prompts:supportPrompts.enhance.apiConfigDescription")}
											</div>
										</div>
										<VSCodeDropdown
											value={enhancementApiConfigId || ""}
											data-testid="api-config-dropdown"
											onChange={(e: any) => {
												const value = e.detail?.target?.value || e.target?.value
												setEnhancementApiConfigId(value)
												vscode.postMessage({
													type: "enhancementApiConfigId",
													text: value,
												})
											}}
											style={{ width: "300px" }}>
											<VSCodeOption value="">
												{t("prompts:supportPrompts.enhance.useCurrentConfig")}
											</VSCodeOption>
											{(listApiConfigMeta || []).map((config) => (
												<VSCodeOption key={config.id} value={config.id}>
													{config.name}
												</VSCodeOption>
											))}
										</VSCodeDropdown>
									</div>
								</div>

								<div style={{ marginTop: "12px" }}>
									<VSCodeTextArea
										value={testPrompt}
										onChange={(e) => setTestPrompt((e.target as HTMLTextAreaElement).value)}
										placeholder={t("prompts:supportPrompts.enhance.testPromptPlaceholder")}
										rows={3}
										resize="vertical"
										style={{ width: "100%" }}
										data-testid="test-prompt-textarea"
									/>
									<div
										style={{
											marginTop: "8px",
											display: "flex",
											justifyContent: "flex-start",
											alignItems: "center",
											gap: 8,
										}}>
										<Button
											variant="default"
											onClick={handleTestEnhancement}
											disabled={isEnhancing}>
											{t("prompts:supportPrompts.enhance.previewButton")}
										</Button>
									</div>
								</div>
							</>
						)}
					</div>
				</div>
				{/* END: Content migrated from PromptsView */}
			</div>
		</div>
	)
}
