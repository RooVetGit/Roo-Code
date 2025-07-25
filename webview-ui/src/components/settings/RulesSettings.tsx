import { HTMLAttributes, useState, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { FileText, AlertTriangle, Info, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StandardTooltip } from "@/components/ui"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type RulesSettingsProps = HTMLAttributes<HTMLDivElement> & {
	hasUnsavedChanges?: boolean
}

interface RuleType {
	id: string
	label: string
	description: string
	checked: boolean
	exists?: boolean
}

export const RulesSettings = ({ className, hasUnsavedChanges, ...props }: RulesSettingsProps) => {
	const { t } = useAppTranslation()
	const [addToGitignore, setAddToGitignore] = useState(true)
	const [alwaysAllowWriteProtected, setAlwaysAllowWriteProtected] = useState(true)
	const [selectedApiConfig, setSelectedApiConfig] = useState<string>("")
	const [includeCustomRules, setIncludeCustomRules] = useState(false)
	const [customRulesText, setCustomRulesText] = useState("")
	const [sourceFileCount, setSourceFileCount] = useState<number | null>(null)

	const { listApiConfigMeta, currentApiConfigName } = useExtensionState()

	const [ruleTypes, setRuleTypes] = useState<RuleType[]>([
		{
			id: "general",
			label: t("settings:rules.types.general.label"),
			description: t("settings:rules.types.general.description"),
			checked: true,
			exists: false,
		},
		{
			id: "code",
			label: t("settings:rules.types.code.label"),
			description: t("settings:rules.types.code.description"),
			checked: true,
			exists: false,
		},
		{
			id: "architect",
			label: t("settings:rules.types.architect.label"),
			description: t("settings:rules.types.architect.description"),
			checked: true,
			exists: false,
		},
		{
			id: "debug",
			label: t("settings:rules.types.debug.label"),
			description: t("settings:rules.types.debug.description"),
			checked: true,
			exists: false,
		},
		{
			id: "docs-extractor",
			label: t("settings:rules.types.docsExtractor.label"),
			description: t("settings:rules.types.docsExtractor.description"),
			checked: true,
			exists: false,
		},
	])

	const handleRuleTypeToggle = (id: string) => {
		setRuleTypes((prev) => prev.map((rule) => (rule.id === id ? { ...rule, checked: !rule.checked } : rule)))
	}

	// Check for existing files and get current settings when component mounts
	useEffect(() => {
		vscode.postMessage({
			type: "checkExistingRuleFiles",
		})

		// Request current state to get alwaysAllowWriteProtected value
		vscode.postMessage({ type: "webviewDidLaunch" })

		// Set default API config
		if (currentApiConfigName && !selectedApiConfig) {
			setSelectedApiConfig(currentApiConfigName)
		}
	}, [currentApiConfigName, selectedApiConfig])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "existingRuleFiles") {
				// Update rule types with existence information
				setRuleTypes((prev) =>
					prev.map((rule) => ({
						...rule,
						exists: message.files?.includes(rule.id) || false,
					})),
				)
				// Set source file count if provided
				if (message.sourceFileCount !== undefined) {
					setSourceFileCount(message.sourceFileCount)
				}
			} else if (message.type === "state") {
				// Update alwaysAllowWriteProtected from the extension state
				if (message.state?.alwaysAllowWriteProtected !== undefined) {
					setAlwaysAllowWriteProtected(message.state.alwaysAllowWriteProtected)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleGenerateRules = () => {
		const selectedRules = ruleTypes.filter((rule) => rule.checked)
		if (selectedRules.length === 0) {
			return
		}

		// Send message to extension to generate rules
		vscode.postMessage({
			type: "generateRules",
			selectedRuleTypes: selectedRules.map((rule) => rule.id),
			addToGitignore,
			alwaysAllowWriteProtected,
			apiConfigName: selectedApiConfig,
			includeCustomRules,
			customRulesText: includeCustomRules ? customRulesText : "",
		})
	}

	const existingRules = ruleTypes.filter((rule) => rule.checked && rule.exists)
	const hasExistingFiles = existingRules.length > 0
	const hasSelectedRules = ruleTypes.some((rule) => rule.checked)

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:rules.description")}>
				<div className="flex items-center gap-2">
					<FileText className="w-4" />
					<div>{t("settings:rules.title")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* Magic Rules Generation subsection */}
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2 font-bold">
								<Sparkles className="w-4 h-4" />
								<div>{t("settings:rules.magicGeneration.title")}</div>
							</div>
							<div className="text-vscode-descriptionForeground">
								{t("settings:rules.magicGeneration.description")}
							</div>
						</div>
						<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
							{/* Recommendation box */}
							<div className="flex items-start gap-2 p-2 bg-vscode-inputValidation-infoBackground border border-vscode-inputValidation-infoBorder rounded-md">
								<Info className="w-4 h-4 text-vscode-inputValidation-infoForeground mt-0.5 flex-shrink-0" />
								<div className="text-sm text-vscode-inputValidation-infoForeground">
									{t("settings:rules.autoApproveRecommendation")}
								</div>
							</div>

							<div>
								<h4 className="text-sm font-medium mb-3">{t("settings:rules.selectTypes")}</h4>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
									{ruleTypes.map((ruleType) => (
										<div
											key={ruleType.id}
											onClick={() => handleRuleTypeToggle(ruleType.id)}
											className={cn(
												"relative p-3 rounded-md border cursor-pointer transition-all",
												"hover:border-vscode-focusBorder",
												ruleType.checked
													? "bg-vscode-list-activeSelectionBackground border-vscode-focusBorder"
													: "bg-vscode-editor-background border-vscode-panel-border",
											)}>
											<div className="flex-1">
												<div className="text-sm font-medium flex items-center gap-1">
													{ruleType.label}
													{ruleType.exists && (
														<span
															className="text-vscode-testing-iconQueued"
															title={t("settings:rules.fileExists")}>
															•
														</span>
													)}
												</div>
												<div className="text-xs text-vscode-descriptionForeground mt-1">
													{ruleType.description}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Small repository warning */}
							{sourceFileCount !== null && sourceFileCount > 0 && sourceFileCount < 20 && (
								<div className="flex items-start gap-2 p-2 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded-md">
									<AlertTriangle className="w-4 h-4 text-vscode-inputValidation-warningForeground mt-0.5 flex-shrink-0" />
									<div className="text-sm text-vscode-inputValidation-warningForeground">
										{t("settings:rules.smallRepoWarning", { count: sourceFileCount })}
									</div>
								</div>
							)}
							{hasExistingFiles && (
								<div className="flex items-start gap-2 p-2 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded-md">
									<AlertTriangle className="w-4 h-4 text-vscode-inputValidation-warningForeground mt-0.5 flex-shrink-0" />
									<div className="text-sm text-vscode-inputValidation-warningForeground">
										<div>{t("settings:rules.overwriteWarning")}</div>
										<ul className="mt-1 ml-4 list-disc">
											{existingRules.map((rule) => (
												<li key={rule.id}>{rule.label}</li>
											))}
										</ul>
									</div>
								</div>
							)}

							<div className="border-t border-vscode-panel-border pt-2 space-y-2">
								<label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
									<input
										type="checkbox"
										checked={addToGitignore}
										onChange={(e) => setAddToGitignore(e.target.checked)}
									/>
									<div>
										<div className="text-sm font-medium">{t("settings:rules.addToGitignore")}</div>
										<div className="text-xs text-vscode-descriptionForeground">
											{t("settings:rules.addToGitignoreDescription")}
										</div>
									</div>
								</label>

								<label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
									<input
										type="checkbox"
										checked={alwaysAllowWriteProtected}
										onChange={(e) => {
											setAlwaysAllowWriteProtected(e.target.checked)
											vscode.postMessage({
												type: "alwaysAllowWriteProtected",
												bool: e.target.checked,
											})
										}}
									/>
									<div>
										<div className="text-sm font-medium">
											{t("settings:rules.autoApproveProtected")}
										</div>
										<div className="text-xs text-vscode-descriptionForeground">
											{t("settings:rules.autoApproveProtectedDescription")}
										</div>
									</div>
								</label>

								<label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
									<input
										type="checkbox"
										checked={includeCustomRules}
										onChange={(e) => setIncludeCustomRules(e.target.checked)}
									/>
									<div>
										<div className="text-sm font-medium">
											{t("settings:rules.includeCustomRules")}
										</div>
										<div className="text-xs text-vscode-descriptionForeground">
											{t("settings:rules.includeCustomRulesDescription")}
										</div>
									</div>
								</label>

								{includeCustomRules && (
									<div className="mt-3 pl-6">
										<VSCodeTextArea
											resize="vertical"
											value={customRulesText}
											onChange={(e) => {
												const value =
													(e as unknown as CustomEvent)?.detail?.target?.value ||
													((e as any).target as HTMLTextAreaElement).value
												setCustomRulesText(value)
											}}
											placeholder={t("settings:rules.customRulesPlaceholder")}
											rows={6}
											className="w-full"
										/>
										<div className="text-xs text-vscode-descriptionForeground mt-1">
											{t("settings:rules.customRulesHint")}
										</div>
									</div>
								)}
							</div>

							<div className="flex flex-col gap-2 mt-3">
								<Select value={selectedApiConfig} onValueChange={setSelectedApiConfig}>
									<SelectTrigger className="w-fit min-w-[5rem] max-w-[8rem]">
										<SelectValue placeholder={t("settings:rules.selectApiConfig")} />
									</SelectTrigger>
									<SelectContent>
										{(listApiConfigMeta || []).map((config) => (
											<SelectItem key={config.id} value={config.name}>
												{config.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<StandardTooltip
									content={
										hasUnsavedChanges
											? t("settings:rules.unsavedChangesError")
											: !hasSelectedRules
												? t("settings:rules.noRulesSelected")
												: t("settings:rules.generateButtonTooltip")
									}>
									<span className="w-full">
										<Button
											onClick={handleGenerateRules}
											disabled={!selectedApiConfig || hasUnsavedChanges || !hasSelectedRules}
											variant="default"
											size="default"
											className="w-full">
											<>
												<FileText className="mr-2 h-4 w-4" />
												{t("settings:rules.generateButton")}
											</>
										</Button>
									</span>
								</StandardTooltip>
							</div>
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
