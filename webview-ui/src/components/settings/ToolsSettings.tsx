import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Wrench } from "lucide-react"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface ToolsSettingsProps {
	enableToolExecuteCommand?: boolean
	enableToolReadFile?: boolean
	enableToolFetchInstructions?: boolean
	enableToolWriteToFile?: boolean
	enableToolApplyDiff?: boolean
	enableToolInsertContent?: boolean
	enableToolSearchAndReplace?: boolean
	enableToolSearchFiles?: boolean
	enableToolListFiles?: boolean
	enableToolListCodeDefinitionNames?: boolean
	enableToolBrowserAction?: boolean
	enableToolUseMcpTool?: boolean
	enableToolAccessMcpResource?: boolean
	enableToolAskFollowupQuestion?: boolean
	enableToolAttemptCompletion?: boolean
	enableToolSwitchMode?: boolean
	enableToolNewTask?: boolean
	enableToolCodebaseSearch?: boolean
	enableToolUpdateTodoList?: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const ToolsSettings: React.FC<ToolsSettingsProps> = ({
	enableToolExecuteCommand = true,
	enableToolReadFile = true,
	enableToolFetchInstructions = true,
	enableToolWriteToFile = true,
	enableToolApplyDiff = true,
	enableToolInsertContent = true,
	enableToolSearchAndReplace = true,
	enableToolSearchFiles = true,
	enableToolListFiles = true,
	enableToolListCodeDefinitionNames = true,
	enableToolBrowserAction = true,
	enableToolUseMcpTool = true,
	enableToolAccessMcpResource = true,
	enableToolAskFollowupQuestion = true,
	enableToolAttemptCompletion = true,
	enableToolSwitchMode = true,
	enableToolNewTask = true,
	enableToolCodebaseSearch = true,
	enableToolUpdateTodoList = true,
	setCachedStateField,
}) => {
	const { t } = useAppTranslation()

	const handleSelectAll = () => {
		const toolKeys = [
			"enableToolExecuteCommand",
			"enableToolReadFile",
			"enableToolFetchInstructions",
			"enableToolWriteToFile",
			"enableToolApplyDiff",
			"enableToolInsertContent",
			"enableToolSearchAndReplace",
			"enableToolSearchFiles",
			"enableToolListFiles",
			"enableToolListCodeDefinitionNames",
			"enableToolBrowserAction",
			"enableToolUseMcpTool",
			"enableToolAccessMcpResource",
			"enableToolAskFollowupQuestion",
			"enableToolAttemptCompletion",
			"enableToolSwitchMode",
			"enableToolNewTask",
			"enableToolCodebaseSearch",
			"enableToolUpdateTodoList",
		]

		toolKeys.forEach((key) => {
			setCachedStateField(key as any, true)
		})
	}

	const handleSelectNone = () => {
		const toolKeys = [
			"enableToolExecuteCommand",
			"enableToolReadFile",
			"enableToolFetchInstructions",
			"enableToolWriteToFile",
			"enableToolApplyDiff",
			"enableToolInsertContent",
			"enableToolSearchAndReplace",
			"enableToolSearchFiles",
			"enableToolListFiles",
			"enableToolListCodeDefinitionNames",
			"enableToolBrowserAction",
			"enableToolUseMcpTool",
			"enableToolAccessMcpResource",
			"enableToolAskFollowupQuestion",
			"enableToolAttemptCompletion",
			"enableToolSwitchMode",
			"enableToolNewTask",
			"enableToolCodebaseSearch",
			"enableToolUpdateTodoList",
		]

		toolKeys.forEach((key) => {
			setCachedStateField(key as any, false)
		})
	}

	// Using existing tool groups from codebase, ordered by usage frequency (most common first)
	const toolGroups = React.useMemo(
		() => [
			// Read group - Very commonly used
			{
				title: t("settings:tools.groups.read"),
				tools: [
					{
						key: "enableToolReadFile",
						value: enableToolReadFile,
						label: t("settings:tools.readFile.label"),
						description: t("settings:tools.readFile.description"),
					},
					{
						key: "enableToolFetchInstructions",
						value: enableToolFetchInstructions,
						label: t("settings:tools.fetchInstructions.label"),
						description: t("settings:tools.fetchInstructions.description"),
					},
					{
						key: "enableToolSearchFiles",
						value: enableToolSearchFiles,
						label: t("settings:tools.searchFiles.label"),
						description: t("settings:tools.searchFiles.description"),
					},
					{
						key: "enableToolListFiles",
						value: enableToolListFiles,
						label: t("settings:tools.listFiles.label"),
						description: t("settings:tools.listFiles.description"),
					},
					{
						key: "enableToolListCodeDefinitionNames",
						value: enableToolListCodeDefinitionNames,
						label: t("settings:tools.listCodeDefinitionNames.label"),
						description: t("settings:tools.listCodeDefinitionNames.description"),
					},
					{
						key: "enableToolCodebaseSearch",
						value: enableToolCodebaseSearch,
						label: t("settings:tools.codebaseSearch.label"),
						description: t("settings:tools.codebaseSearch.description"),
					},
				],
			},
			// Edit group - Very commonly used
			{
				title: t("settings:tools.groups.edit"),
				tools: [
					{
						key: "enableToolApplyDiff",
						value: enableToolApplyDiff,
						label: t("settings:tools.applyDiff.label"),
						description: t("settings:tools.applyDiff.description"),
					},
					{
						key: "enableToolWriteToFile",
						value: enableToolWriteToFile,
						label: t("settings:tools.writeToFile.label"),
						description: t("settings:tools.writeToFile.description"),
					},
					{
						key: "enableToolInsertContent",
						value: enableToolInsertContent,
						label: t("settings:tools.insertContent.label"),
						description: t("settings:tools.insertContent.description"),
					},
					{
						key: "enableToolSearchAndReplace",
						value: enableToolSearchAndReplace,
						label: t("settings:tools.searchAndReplace.label"),
						description: t("settings:tools.searchAndReplace.description"),
					},
				],
			},
			// Command group - Moderately used
			{
				title: t("settings:tools.groups.command"),
				tools: [
					{
						key: "enableToolExecuteCommand",
						value: enableToolExecuteCommand,
						label: t("settings:tools.executeCommand.label"),
						description: t("settings:tools.executeCommand.description"),
					},
				],
			},
			// Browser group - Less commonly used
			{
				title: t("settings:tools.groups.browser"),
				tools: [
					{
						key: "enableToolBrowserAction",
						value: enableToolBrowserAction,
						label: t("settings:tools.browserAction.label"),
						description: t("settings:tools.browserAction.description"),
					},
				],
			},
			// Modes group - Above MCP
			{
				title: t("settings:tools.groups.modes"),
				tools: [
					{
						key: "enableToolSwitchMode",
						value: enableToolSwitchMode,
						label: t("settings:tools.switchMode.label"),
						description: t("settings:tools.switchMode.description"),
					},
					{
						key: "enableToolNewTask",
						value: enableToolNewTask,
						label: t("settings:tools.newTask.label"),
						description: t("settings:tools.newTask.description"),
					},
				],
			},
			// MCP group - Near bottom
			{
				title: t("settings:tools.groups.mcp"),
				tools: [
					{
						key: "enableToolUseMcpTool",
						value: enableToolUseMcpTool,
						label: t("settings:tools.useMcpTool.label"),
						description: t("settings:tools.useMcpTool.description"),
					},
					{
						key: "enableToolAccessMcpResource",
						value: enableToolAccessMcpResource,
						label: t("settings:tools.accessMcpResource.label"),
						description: t("settings:tools.accessMcpResource.description"),
					},
				],
			},
			// Always available tools - At the very bottom
			{
				title: t("settings:tools.groups.alwaysAvailable"),
				tools: [
					{
						key: "enableToolAskFollowupQuestion",
						value: enableToolAskFollowupQuestion,
						label: t("settings:tools.askFollowupQuestion.label"),
						description: t("settings:tools.askFollowupQuestion.description"),
					},
					{
						key: "enableToolAttemptCompletion",
						value: enableToolAttemptCompletion,
						label: t("settings:tools.attemptCompletion.label"),
						description: t("settings:tools.attemptCompletion.description"),
					},
					{
						key: "enableToolUpdateTodoList",
						value: enableToolUpdateTodoList,
						label: t("settings:tools.updateTodoList.label"),
						description: t("settings:tools.updateTodoList.description"),
					},
				],
			},
		],
		[
			t,
			enableToolAccessMcpResource,
			enableToolApplyDiff,
			enableToolAskFollowupQuestion,
			enableToolAttemptCompletion,
			enableToolBrowserAction,
			enableToolCodebaseSearch,
			enableToolExecuteCommand,
			enableToolFetchInstructions,
			enableToolInsertContent,
			enableToolListCodeDefinitionNames,
			enableToolListFiles,
			enableToolNewTask,
			enableToolReadFile,
			enableToolSearchAndReplace,
			enableToolSearchFiles,
			enableToolSwitchMode,
			enableToolUpdateTodoList,
			enableToolUseMcpTool,
			enableToolWriteToFile,
		],
	)

	return (
		<Section>
			<SectionHeader description={t("settings:tools.description")}>
				<div className="flex items-center gap-2">
					<Wrench className="w-4 h-4" />
					{t("settings:tools.title")}
				</div>
			</SectionHeader>
			<div className="space-y-4 px-5 pb-4">
				<div className="flex gap-2 mb-4">
					<VSCodeButton onClick={handleSelectAll}>{t("settings:tools.selectAll")}</VSCodeButton>
					<VSCodeButton onClick={handleSelectNone}>{t("settings:tools.selectNone")}</VSCodeButton>
				</div>
				<div className="space-y-6">
					{toolGroups.map((group) => (
						<div key={group.title}>
							<h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-1">
								{group.title}
							</h4>
							<div className="grid gap-1">
								{group.tools.map((tool) => (
									<div key={tool.key} className="flex items-start space-x-3">
										<VSCodeCheckbox
											checked={tool.value}
											onChange={(e) => {
												const target = e.target as HTMLInputElement
												setCachedStateField(tool.key as any, target.checked)
											}}
										/>
										<div className="flex-1 min-w-0">
											<label className="text-sm font-medium cursor-pointer">{tool.label}</label>
											<p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</Section>
	)
}
