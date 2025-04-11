import { HTMLAttributes, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type AutoApproveSettingsProps = HTMLAttributes<HTMLDivElement> & {
	alwaysAllowReadOnly?: boolean
	alwaysAllowReadOnlyOutsideWorkspace?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowWriteOutsideWorkspace?: boolean
	writeDelayMs: number
	alwaysAllowBrowser?: boolean
	alwaysApproveResubmit?: boolean
	requestDelaySeconds: number
	alwaysAllowMcp?: boolean
	alwaysAllowModeSwitch?: boolean
	alwaysAllowSubtasks?: boolean
	alwaysAllowExecute?: boolean
	allowedCommands?: string[]
	setCachedStateField: SetCachedStateField<
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "writeDelayMs"
		| "alwaysAllowBrowser"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "alwaysAllowExecute"
		| "allowedCommands"
	>
}

export const AutoApproveSettings = ({
	alwaysAllowReadOnly,
	alwaysAllowReadOnlyOutsideWorkspace,
	alwaysAllowWrite,
	alwaysAllowWriteOutsideWorkspace,
	writeDelayMs,
	alwaysAllowBrowser,
	alwaysApproveResubmit,
	requestDelaySeconds,
	alwaysAllowMcp,
	alwaysAllowModeSwitch,
	alwaysAllowSubtasks,
	alwaysAllowExecute,
	allowedCommands,
	setCachedStateField,
	className,
	...props
}: AutoApproveSettingsProps) => {
	const { t } = useAppTranslation()
	const [commandInput, setCommandInput] = useState("")

	const handleAddCommand = () => {
		const currentCommands = allowedCommands ?? []
		if (commandInput && !currentCommands.includes(commandInput)) {
			const newCommands = [...currentCommands, commandInput]
			setCachedStateField("allowedCommands", newCommands)
			setCommandInput("")
			vscode.postMessage({ type: "allowedCommands", commands: newCommands })
		}
	}

	return (
		<div {...props}>
			<SectionHeader description={t("settings:autoApprove.description")}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-check w-4" />
					<div>{t("settings:sections.autoApprove")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div
					className="grid grid-cols-2 [@media(min-width:240px)]:grid-cols-3 [@media(min-width:320px)]:grid-cols-4 gap-4"
					style={{
						transition: "all 0.2s",
					}}>
					<VSCodeButton
						appearance={alwaysAllowReadOnly ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowReadOnly", !alwaysAllowReadOnly)}
						title={t("settings:autoApprove.readOnly.description")}
						data-testid="always-allow-readonly-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-eye"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.readOnly.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowWrite ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowWrite", !alwaysAllowWrite)}
						title={t("settings:autoApprove.write.description")}
						data-testid="always-allow-write-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-edit"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.write.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowBrowser ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowBrowser", !alwaysAllowBrowser)}
						title={`${t("settings:autoApprove.browser.description")}\n${t("settings:autoApprove.browser.note")}`}
						data-testid="always-allow-browser-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-globe"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.browser.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysApproveResubmit ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysApproveResubmit", !alwaysApproveResubmit)}
						title={t("settings:autoApprove.retry.description")}
						data-testid="always-approve-resubmit-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-refresh"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.retry.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowMcp ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowMcp", !alwaysAllowMcp)}
						title={t("settings:autoApprove.mcp.description")}
						data-testid="always-allow-mcp-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-plug"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.mcp.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowModeSwitch ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowModeSwitch", !alwaysAllowModeSwitch)}
						title={t("settings:autoApprove.modeSwitch.description")}
						data-testid="always-allow-mode-switch-toggle"
						className="aspect-square min-h-[48px] min-w-[48px]"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-sync"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.modeSwitch.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowSubtasks ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowSubtasks", !alwaysAllowSubtasks)}
						title={t("settings:autoApprove.subtasks.description")}
						data-testid="always-allow-subtasks-toggle"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-list-unordered"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.subtasks.label")}
						</span>
					</VSCodeButton>
					<VSCodeButton
						appearance={alwaysAllowExecute ? "primary" : "secondary"}
						onClick={() => setCachedStateField("alwaysAllowExecute", !alwaysAllowExecute)}
						title={t("settings:autoApprove.execute.description")}
						data-testid="always-allow-execute-toggle"
						style={{ transition: "background-color 0.2s" }}>
						<span className="flex flex-col items-center gap-1 h-full">
							<span
								className="codicon codicon-terminal"
								style={{ fontSize: "1.5rem", fontWeight: "bold", paddingTop: "0.5rem" }}
							/>
							{t("settings:autoApprove.execute.label")}
						</span>
					</VSCodeButton>
				</div>

				{alwaysAllowExecute && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<label className="block font-medium mb-1" data-testid="allowed-commands-heading">
								{t("settings:autoApprove.execute.allowedCommands")}
							</label>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.execute.allowedCommandsDescription")}
							</div>
						</div>

						<div className="flex gap-2">
							<VSCodeTextField
								value={commandInput}
								onInput={(e: any) => setCommandInput(e.target.value)}
								onKeyDown={(e: any) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddCommand()
									}
								}}
								placeholder={t("settings:autoApprove.execute.commandPlaceholder")}
								className="grow"
								data-testid="command-input"
							/>
							<VSCodeButton onClick={handleAddCommand} data-testid="add-command-button">
								{t("settings:autoApprove.execute.addButton")}
							</VSCodeButton>
						</div>

						<div className="flex flex-wrap gap-2">
							{(allowedCommands ?? []).map((cmd, index) => (
								<div
									key={index}
									className="border border-vscode-input-border bg-primary text-primary-foreground flex items-center gap-1 rounded-xs px-1.5 p-0.5">
									<span>{cmd}</span>
									<VSCodeButton
										appearance="icon"
										className="text-primary-foreground"
										data-testid={`remove-command-${index}`}
										onClick={() => {
											const newCommands = (allowedCommands ?? []).filter((_, i) => i !== index)
											setCachedStateField("allowedCommands", newCommands)
											vscode.postMessage({ type: "allowedCommands", commands: newCommands })
										}}>
										<span className="codicon codicon-close" />
									</VSCodeButton>
								</div>
							))}
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
