/// <reference types="react" />
import React, { HTMLAttributes } from "react"
import { X } from "lucide-react"
import type { KeyboardEvent } from "react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "@/utils/vscode"
import { Button, Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { AutoApproveToggle, AutoApproveSetting, autoApproveSettingsConfig } from "./AutoApproveToggle"

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
	allowedCommands?: readonly string[]
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

export const AutoApproveSettings: React.FC<AutoApproveSettingsProps> = ({
	alwaysAllowReadOnly = false,
	alwaysAllowReadOnlyOutsideWorkspace = false,
	alwaysAllowWrite = false,
	alwaysAllowWriteOutsideWorkspace = false,
	writeDelayMs = 0,
	alwaysAllowBrowser = false,
	alwaysApproveResubmit = false,
	requestDelaySeconds = 5,
	alwaysAllowMcp = false,
	alwaysAllowModeSwitch = false,
	alwaysAllowSubtasks = false,
	alwaysAllowExecute = false,
	allowedCommands = [],
	setCachedStateField,
	...props
}) => {
	const { t } = useAppTranslation()
	const [commandInput, setCommandInput] = React.useState("")

	const hasEnabledActions = [
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowBrowser,
		alwaysApproveResubmit,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowExecute
	].some(Boolean)

	const enabledActionsList = hasEnabledActions
		? Object.entries({
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowBrowser,
			alwaysApproveResubmit,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysAllowExecute
			})
			.filter(([_, value]) => !!value)
			.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
			.join(", ")
		: t("chat:autoApprove.none")

	const handleAddCommand = () => {
		if (commandInput && !allowedCommands.includes(commandInput)) {
			const newCommands = [...(allowedCommands as string[]), commandInput]
			setCachedStateField("allowedCommands", newCommands)
			setCommandInput("")
			vscode.postMessage({ type: "allowedCommands", commands: newCommands })
		}
	}

	const handleCheckboxChange = (field: keyof Omit<AutoApproveSettingsProps, "writeDelayMs" | "requestDelaySeconds" | "allowedCommands" | "setCachedStateField" | keyof HTMLAttributes<HTMLDivElement>>) => 
		(e: Event | React.FormEvent<HTMLElement>) => {
			const target = (e as CustomEvent)?.detail?.target || (e.target as HTMLInputElement)
			setCachedStateField(field, target.checked)
		}

	const handleInputChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = (e as CustomEvent)?.detail?.target || (e.target as HTMLInputElement)
		setCommandInput(target.value)
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			handleAddCommand()
		}
	}

	return (
		<div {...props}>
			<SectionHeader 
				description={t("settings:autoApprove.description")}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-check w-4" />
					<div>{t("settings:sections.autoApprove")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-2">
						<span>{t("settings:autoApprove.status")}</span>
						<span className="text-vscode-descriptionForeground">
							{enabledActionsList}
						</span>
					</div>

					<AutoApproveToggle {...{
						alwaysAllowReadOnly,
						alwaysAllowWrite,
						alwaysAllowBrowser,
						alwaysApproveResubmit,
						alwaysAllowMcp,
						alwaysAllowModeSwitch,
						alwaysAllowSubtasks,
						alwaysAllowExecute
					}} onToggle={(key, value) => setCachedStateField(key, value)} />
				</div>

				{/* ADDITIONAL SETTINGS */}

				{alwaysAllowReadOnly && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background mt-4">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-eye" />
							<div>{t("settings:autoApprove.readOnly.label")}</div>
						</div>
						<div>
							<VSCodeCheckbox
								checked={alwaysAllowReadOnlyOutsideWorkspace}
								onChange={handleCheckboxChange("alwaysAllowReadOnlyOutsideWorkspace")}
								data-testid="always-allow-readonly-outside-workspace-checkbox">
								<span className="font-medium">
									{t("settings:autoApprove.readOnly.outsideWorkspace.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.readOnly.outsideWorkspace.description")}
							</div>
						</div>
					</div>
				)}

				{alwaysAllowWrite && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background mt-4">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-edit" />
							<div>{t("settings:autoApprove.write.label")}</div>
						</div>
						<div>
							<VSCodeCheckbox
								checked={alwaysAllowWriteOutsideWorkspace}
								onChange={handleCheckboxChange("alwaysAllowWriteOutsideWorkspace")}
								data-testid="always-allow-write-outside-workspace-checkbox">
								<span className="font-medium">
									{t("settings:autoApprove.write.outsideWorkspace.label")}
								</span>
							</VSCodeCheckbox>
							<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
								{t("settings:autoApprove.write.outsideWorkspace.description")}
							</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={5000}
									step={100}
									value={[writeDelayMs]}
									onValueChange={([value]: number[]) => setCachedStateField("writeDelayMs", value)}
									data-testid="write-delay-slider"
								/>
								<span className="w-20">{writeDelayMs}ms</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.write.delayLabel")}
							</div>
						</div>
					</div>
				)}

				{alwaysApproveResubmit && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background mt-4">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-refresh" />
							<div>{t("settings:autoApprove.retry.label")}</div>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Slider
									min={5}
									max={100}
									step={1}
									value={[requestDelaySeconds]}
									onValueChange={([value]: number[]) => setCachedStateField("requestDelaySeconds", value)}
									data-testid="request-delay-slider"
								/>
								<span className="w-20">{requestDelaySeconds}s</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:autoApprove.retry.delayLabel")}
							</div>
						</div>
					</div>
				)}

				{alwaysAllowExecute && (
					<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background mt-4">
						<div className="flex items-center gap-4 font-bold">
							<span className="codicon codicon-terminal" />
							<div>{t("settings:autoApprove.execute.label")}</div>
						</div>

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
								onInput={handleInputChange}
								onKeyDown={handleKeyDown}
								placeholder={t("settings:autoApprove.execute.commandPlaceholder")}
								className="grow"
								data-testid="command-input"
							/>
							<Button onClick={handleAddCommand} data-testid="add-command-button">
								{t("settings:autoApprove.execute.addButton")}
							</Button>
						</div>

						<div className="flex flex-wrap gap-2">
							{allowedCommands.map((cmd: string, index: number) => (
								<Button
									key={index}
									variant="secondary"
									data-testid={`remove-command-${index}`}
									onClick={() => {
										const newCommands = allowedCommands.filter((_, i) => i !== index)
										setCachedStateField("allowedCommands", newCommands)
										vscode.postMessage({ type: "allowedCommands", commands: newCommands })
									}}>
									<div className="flex flex-row items-center gap-1">
										<div>{cmd}</div>
										<X className="text-primary-foreground scale-75" />
									</div>
								</Button>
							))}
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
