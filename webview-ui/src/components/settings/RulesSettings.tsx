import { HTMLAttributes, useState, useEffect } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { FileText, AlertTriangle, Terminal } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SetCachedStateField } from "./types"

type RulesSettingsProps = HTMLAttributes<HTMLDivElement> & {
	rulesSettings?: {
		selectedRuleTypes: string[]
		addToGitignore: boolean
		includeCustomRules: boolean
		customRulesText: string
	}
	setCachedStateField: SetCachedStateField<"rulesSettings">
}

interface RuleType {
	id: string
	label: string
	description: string
	checked: boolean
	exists?: boolean
}

export const RulesSettings = ({ rulesSettings, setCachedStateField, className, ...props }: RulesSettingsProps) => {
	const { t } = useAppTranslation()
	const [sourceFileCount, setSourceFileCount] = useState<number | null>(null)

	const allRuleTypes = [
		{
			id: "general",
			label: t("settings:rules.types.general.label"),
			description: t("settings:rules.types.general.description"),
		},
		{
			id: "code",
			label: t("settings:rules.types.code.label"),
			description: t("settings:rules.types.code.description"),
		},
		{
			id: "architect",
			label: t("settings:rules.types.architect.label"),
			description: t("settings:rules.types.architect.description"),
		},
		{
			id: "debug",
			label: t("settings:rules.types.debug.label"),
			description: t("settings:rules.types.debug.description"),
		},
		{
			id: "docs-extractor",
			label: t("settings:rules.types.docsExtractor.label"),
			description: t("settings:rules.types.docsExtractor.description"),
		},
	]

	const [ruleTypes, setRuleTypes] = useState<RuleType[]>(
		allRuleTypes.map((ruleType) => ({
			...ruleType,
			checked: rulesSettings?.selectedRuleTypes.includes(ruleType.id) ?? true,
			exists: false,
		})),
	)

	// Update rule types when rulesSettings prop changes
	useEffect(() => {
		if (rulesSettings) {
			setRuleTypes((prev) =>
				prev.map((ruleType) => ({
					...ruleType,
					checked: rulesSettings.selectedRuleTypes.includes(ruleType.id),
				})),
			)
		}
	}, [rulesSettings])

	const handleRuleTypeToggle = (id: string) => {
		setRuleTypes((prev) => prev.map((rule) => (rule.id === id ? { ...rule, checked: !rule.checked } : rule)))

		// Update the cached state using the proper pattern
		const updatedRules = ruleTypes.map((rule) => (rule.id === id ? { ...rule, checked: !rule.checked } : rule))
		const selectedRuleTypes = updatedRules.filter((rule) => rule.checked).map((rule) => rule.id)

		setCachedStateField("rulesSettings", {
			selectedRuleTypes,
			addToGitignore: rulesSettings?.addToGitignore ?? true,
			includeCustomRules: rulesSettings?.includeCustomRules ?? false,
			customRulesText: rulesSettings?.customRulesText ?? "",
		})
	}

	const handleGitignoreToggle = (checked: boolean) => {
		setCachedStateField("rulesSettings", {
			selectedRuleTypes: rulesSettings?.selectedRuleTypes ?? [
				"general",
				"code",
				"architect",
				"debug",
				"docs-extractor",
			],
			addToGitignore: checked,
			includeCustomRules: rulesSettings?.includeCustomRules ?? false,
			customRulesText: rulesSettings?.customRulesText ?? "",
		})
	}

	const handleIncludeCustomRulesToggle = (checked: boolean) => {
		setCachedStateField("rulesSettings", {
			selectedRuleTypes: rulesSettings?.selectedRuleTypes ?? [
				"general",
				"code",
				"architect",
				"debug",
				"docs-extractor",
			],
			addToGitignore: rulesSettings?.addToGitignore ?? true,
			includeCustomRules: checked,
			customRulesText: rulesSettings?.customRulesText ?? "",
		})
	}

	const handleCustomRulesTextChange = (text: string) => {
		setCachedStateField("rulesSettings", {
			selectedRuleTypes: rulesSettings?.selectedRuleTypes ?? [
				"general",
				"code",
				"architect",
				"debug",
				"docs-extractor",
			],
			addToGitignore: rulesSettings?.addToGitignore ?? true,
			includeCustomRules: rulesSettings?.includeCustomRules ?? false,
			customRulesText: text,
		})
	}

	// Check for existing files when component mounts
	useEffect(() => {
		vscode.postMessage({
			type: "checkExistingRuleFiles",
		})

		// Request current rules settings
		vscode.postMessage({ type: "getRulesSettings" })
	}, [])

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
			} else if (message.type === "rulesSettings") {
				// Update settings from saved preferences - this is now handled by props
				// The component will re-render when rulesSettings prop changes
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const existingRules = ruleTypes.filter((rule) => rule.checked && rule.exists)
	const hasExistingFiles = existingRules.length > 0

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:rules.description")}>
				<div className="flex items-center gap-2">
					<FileText className="w-4" />
					<div>{t("settings:rules.title")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-4">
					{/* Command Line Instructions */}
					<div className="flex items-start gap-2">
						<Terminal className="w-4 h-4 text-vscode-foreground mt-0.5 flex-shrink-0" />
						<div>
							<div className="font-medium mb-1">
								{t("settings:rules.commandTitle")}{" "}
								<code className="bg-vscode-textBlockQuote-background px-2 py-1 rounded">
									/make-rules
								</code>
							</div>
							<div className="text-vscode-descriptionForeground">
								{t("settings:rules.commandDescription")}
							</div>
						</div>
					</div>

					{/* Settings Content */}
					<div className="pl-3 border-l-2 border-vscode-button-background space-y-4">
						{/* Add to .gitignore option */}
						<label className="flex items-center gap-2 cursor-pointer hover:opacity-80">
							<input
								type="checkbox"
								checked={rulesSettings?.addToGitignore ?? true}
								onChange={(e) => handleGitignoreToggle(e.target.checked)}
							/>
							<div>
								<div className="font-medium">{t("settings:rules.addToGitignore")}</div>
								<div className="text-vscode-descriptionForeground text-sm">
									{t("settings:rules.addToGitignoreDescription")}
								</div>
							</div>
						</label>

						{/* Rule Type Selection */}
						<div>
							<h4 className="font-medium mb-3">{t("settings:rules.selectTypes")}</h4>
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
											<div className="font-medium flex items-center gap-1">
												{ruleType.label}
												{ruleType.exists && (
													<span
														className="text-vscode-testing-iconQueued"
														title={t("settings:rules.fileExists")}>
														•
													</span>
												)}
											</div>
											<div className="text-vscode-descriptionForeground text-sm mt-1">
												{ruleType.description}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Custom Rules Section */}
						<div>
							<label className="flex items-center gap-2 cursor-pointer hover:opacity-80 mb-3">
								<input
									type="checkbox"
									checked={rulesSettings?.includeCustomRules ?? false}
									onChange={(e) => handleIncludeCustomRulesToggle(e.target.checked)}
								/>
								<div>
									<div className="font-medium">{t("settings:rules.includeCustomRules")}</div>
									<div className="text-vscode-descriptionForeground text-sm">
										{t("settings:rules.includeCustomRulesDescription")}
									</div>
								</div>
							</label>

							{rulesSettings?.includeCustomRules && (
								<div className="mt-3">
									<label className="block font-medium mb-1">Custom Rules Template</label>
									<VSCodeTextArea
										resize="vertical"
										value={rulesSettings?.customRulesText ?? ""}
										onChange={(e) => {
											const value =
												(e as unknown as CustomEvent)?.detail?.target?.value ||
												((e as any).target as HTMLTextAreaElement).value
											handleCustomRulesTextChange(value)
										}}
										placeholder={t("settings:rules.customRulesPlaceholder")}
										rows={6}
										className="w-full"
									/>
									<div className="text-sm text-vscode-descriptionForeground mt-1">
										{t("settings:rules.customRulesHint")}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Small repository warning */}
					{sourceFileCount !== null && sourceFileCount > 0 && sourceFileCount < 20 && (
						<div className="flex items-start gap-2 p-2 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded-md">
							<AlertTriangle className="w-4 h-4 text-vscode-inputValidation-warningForeground mt-0.5 flex-shrink-0" />
							<div className="text-vscode-inputValidation-warningForeground">
								{t("settings:rules.smallRepoWarning", { count: sourceFileCount })}
							</div>
						</div>
					)}

					{/* Existing files warning */}
					{hasExistingFiles && (
						<div className="flex items-start gap-2 p-2 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded-md">
							<AlertTriangle className="w-4 h-4 text-vscode-inputValidation-warningForeground mt-0.5 flex-shrink-0" />
							<div className="text-vscode-inputValidation-warningForeground">
								<div>{t("settings:rules.overwriteWarning")}</div>
								<ul className="mt-1 ml-4 list-disc">
									{existingRules.map((rule) => (
										<li key={rule.id}>{rule.label}</li>
									))}
								</ul>
							</div>
						</div>
					)}
				</div>
			</Section>
		</div>
	)
}
