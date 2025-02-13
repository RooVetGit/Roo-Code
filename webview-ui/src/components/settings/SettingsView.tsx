import { VSCodeButton, VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { memo, useEffect, useState } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration, validateModelId } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "./ApiOptions"
import SettingCheckbox from "./SettingCheckbox"
import SettingCombo from "./SettingCombo"
import SettingSlider from "./SettingSlider"
import { EXPERIMENT_IDS, experimentConfigsMap } from "../../../../src/shared/experiments"
import ApiConfigManager from "./ApiConfigManager"

type SettingsViewProps = {
	onDone: () => void
}

const SettingsView = ({ onDone }: SettingsViewProps) => {
	const {
		apiConfiguration,
		version,
		alwaysAllowReadOnly,
		setAlwaysAllowReadOnly,
		alwaysAllowWrite,
		setAlwaysAllowWrite,
		alwaysAllowExecute,
		setAlwaysAllowExecute,
		alwaysAllowBrowser,
		setAlwaysAllowBrowser,
		alwaysAllowMcp,
		setAlwaysAllowMcp,
		soundEnabled,
		setSoundEnabled,
		soundVolume,
		setSoundVolume,
		diffEnabled,
		setDiffEnabled,
		checkpointsEnabled,
		setCheckpointsEnabled,
		browserViewportSize,
		setBrowserViewportSize,
		openRouterModels,
		glamaModels,
		setAllowedCommands,
		allowedCommands,
		fuzzyMatchThreshold,
		setFuzzyMatchThreshold,
		writeDelayMs,
		setWriteDelayMs,
		screenshotQuality,
		setScreenshotQuality,
		terminalOutputLineLimit,
		setTerminalOutputLineLimit,
		mcpEnabled,
		alwaysApproveResubmit,
		setAlwaysApproveResubmit,
		requestDelaySeconds,
		setRequestDelaySeconds,
		rateLimitSeconds,
		setRateLimitSeconds,
		currentApiConfigName,
		listApiConfigMeta,
		experiments,
		setExperimentEnabled,
		alwaysAllowModeSwitch,
		setAlwaysAllowModeSwitch,
		maxOpenTabsContext,
		setMaxOpenTabsContext,
	} = useExtensionState()
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [modelIdErrorMessage, setModelIdErrorMessage] = useState<string | undefined>(undefined)
	const [commandInput, setCommandInput] = useState("")

	const handleSubmit = () => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		const modelIdValidationResult = validateModelId(apiConfiguration, glamaModels, openRouterModels)

		setApiErrorMessage(apiValidationResult)
		setModelIdErrorMessage(modelIdValidationResult)
		if (!apiValidationResult && !modelIdValidationResult) {
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "alwaysAllowWrite", bool: alwaysAllowWrite })
			vscode.postMessage({ type: "alwaysAllowExecute", bool: alwaysAllowExecute })
			vscode.postMessage({ type: "alwaysAllowBrowser", bool: alwaysAllowBrowser })
			vscode.postMessage({ type: "alwaysAllowMcp", bool: alwaysAllowMcp })
			vscode.postMessage({ type: "allowedCommands", commands: allowedCommands ?? [] })
			vscode.postMessage({ type: "soundEnabled", bool: soundEnabled })
			vscode.postMessage({ type: "soundVolume", value: soundVolume })
			vscode.postMessage({ type: "diffEnabled", bool: diffEnabled })
			vscode.postMessage({ type: "checkpointsEnabled", bool: checkpointsEnabled })
			vscode.postMessage({ type: "browserViewportSize", text: browserViewportSize })
			vscode.postMessage({ type: "fuzzyMatchThreshold", value: fuzzyMatchThreshold ?? 1.0 })
			vscode.postMessage({ type: "writeDelayMs", value: writeDelayMs })
			vscode.postMessage({ type: "screenshotQuality", value: screenshotQuality ?? 75 })
			vscode.postMessage({ type: "terminalOutputLineLimit", value: terminalOutputLineLimit ?? 500 })
			vscode.postMessage({ type: "mcpEnabled", bool: mcpEnabled })
			vscode.postMessage({ type: "alwaysApproveResubmit", bool: alwaysApproveResubmit })
			vscode.postMessage({ type: "requestDelaySeconds", value: requestDelaySeconds })
			vscode.postMessage({ type: "rateLimitSeconds", value: rateLimitSeconds })
			vscode.postMessage({ type: "maxOpenTabsContext", value: maxOpenTabsContext })
			vscode.postMessage({ type: "currentApiConfigName", text: currentApiConfigName })
			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: currentApiConfigName,
				apiConfiguration,
			})

			vscode.postMessage({
				type: "updateExperimental",
				values: experiments,
			})

			vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: alwaysAllowModeSwitch })
			onDone()
		}
	}

	useEffect(() => {
		setApiErrorMessage(undefined)
		setModelIdErrorMessage(undefined)
	}, [apiConfiguration])

	// Initial validation on mount
	useEffect(() => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		const modelIdValidationResult = validateModelId(apiConfiguration, glamaModels, openRouterModels)
		setApiErrorMessage(apiValidationResult)
		setModelIdErrorMessage(modelIdValidationResult)
	}, [apiConfiguration, glamaModels, openRouterModels])

	const handleResetState = () => {
		vscode.postMessage({ type: "resetState" })
	}

	const handleAddCommand = () => {
		const currentCommands = allowedCommands ?? []
		if (commandInput && !currentCommands.includes(commandInput)) {
			const newCommands = [...currentCommands, commandInput]
			setAllowedCommands(newCommands)
			setCommandInput("")
			vscode.postMessage({
				type: "allowedCommands",
				commands: newCommands,
			})
		}
	}

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				padding: "10px 0px 0px 20px",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "17px",
					paddingRight: 17,
				}}>
				<h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>Settings</h3>
				<VSCodeButton onClick={handleSubmit}>Done</VSCodeButton>
			</div>
			<div
				style={{ flexGrow: 1, overflowY: "scroll", paddingRight: 8, display: "flex", flexDirection: "column" }}>
				<div style={{ marginBottom: 10 }}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Provider Settings</h3>
					<div style={{ marginBottom: 15 }}>
						<ApiConfigManager
							currentApiConfigName={currentApiConfigName}
							listApiConfigMeta={listApiConfigMeta}
							onSelectConfig={(configName: string) => {
								vscode.postMessage({
									type: "saveApiConfiguration",
									text: currentApiConfigName,
									apiConfiguration,
								})
								vscode.postMessage({
									type: "loadApiConfiguration",
									text: configName,
								})
							}}
							onDeleteConfig={(configName: string) => {
								vscode.postMessage({
									type: "deleteApiConfiguration",
									text: configName,
								})
							}}
							onRenameConfig={(oldName: string, newName: string) => {
								vscode.postMessage({
									type: "renameApiConfiguration",
									values: { oldName, newName },
									apiConfiguration,
								})
							}}
							onUpsertConfig={(configName: string) => {
								vscode.postMessage({
									type: "upsertApiConfiguration",
									text: configName,
									apiConfiguration,
								})
							}}
						/>
						<ApiOptions apiErrorMessage={apiErrorMessage} modelIdErrorMessage={modelIdErrorMessage} />
					</div>
				</div>

				<div
					style={{
						marginBottom: 15,
						marginTop: 10,
						paddingLeft: 10,
						borderLeft: "2px solid",
						borderColor: "var(--vscode-button-background)",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Auto-Approve Settings</h3>
					<p style={{ fontSize: "12px", marginBottom: 15, color: "var(--vscode-descriptionForeground)" }}>
						The following settings allow Roo to automatically perform operations without requiring approval.
						Enable these settings only if you fully trust the AI and understand the associated security
						risks.
					</p>

					<SettingCheckbox
						name="Always approve read-only operations"
						description="When enabled, Roo will automatically view directory contents and read files without requiring you to click the Approve button."
						checked={alwaysAllowReadOnly}
						onChange={setAlwaysAllowReadOnly}
					/>

					<SettingCheckbox
						name="Always approve write operations"
						description="Automatically create and edit files without requiring approval"
						checked={alwaysAllowWrite}
						onChange={setAlwaysAllowWrite}>
						<SettingSlider
							name=""
							description="Delay after writes to allow diagnostics to detect potential problems"
							value={writeDelayMs}
							onChange={setWriteDelayMs}
							min={0}
							max={5000}
							step={100}
							unit="ms"
						/>
					</SettingCheckbox>

					<SettingCheckbox
						name="Always approve browser actions"
						description="Automatically perform browser actions without requiring approval
Note: Only applies when the model supports computer use"
						checked={alwaysAllowBrowser}
						onChange={setAlwaysAllowBrowser}
					/>

					<SettingCheckbox
						name="Always retry failed API requests"
						description="Automatically retry failed API requests when server returns an error response"
						checked={alwaysApproveResubmit}
						onChange={setAlwaysApproveResubmit}>
						<SettingSlider
							name=""
							description="Delay before retrying the request"
							value={requestDelaySeconds}
							onChange={setRequestDelaySeconds}
							min={5}
							max={100}
							step={1}
							unit="s"
						/>
					</SettingCheckbox>

					<SettingCheckbox
						name="Always approve MCP tools"
						description="Enable auto-approval of individual MCP tools in the MCP Servers view (requires both this setting and the tool's individual 'Always allow' checkbox)"
						checked={alwaysAllowMcp}
						onChange={setAlwaysAllowMcp}
					/>

					<SettingCheckbox
						name="Always approve mode switching & task creation"
						description="Automatically switch between different AI modes and create new tasks without requiring approval"
						checked={alwaysAllowModeSwitch}
						onChange={setAlwaysAllowModeSwitch}
					/>

					<SettingCheckbox
						name="Always approve allowed execute operations"
						description="Automatically execute allowed terminal commands without requiring approval"
						checked={alwaysAllowExecute}
						onChange={setAlwaysAllowExecute}>
						<span style={{ fontWeight: "500" }}>Allowed Auto-Execute Commands</span>
						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							Command prefixes that can be auto-executed when "Always approve execute operations" is
							enabled.
						</p>

						<div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
							<VSCodeTextField
								value={commandInput}
								onInput={(e: any) => setCommandInput(e.target.value)}
								onKeyDown={(e: any) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddCommand()
									}
								}}
								placeholder="Enter command prefix (e.g., 'git ')"
								style={{ flexGrow: 1 }}
							/>
							<VSCodeButton onClick={handleAddCommand}>Add</VSCodeButton>
						</div>

						<div
							style={{
								marginTop: "10px",
								display: "flex",
								flexWrap: "wrap",
								gap: "5px",
							}}>
							{(allowedCommands ?? []).map((cmd, index) => (
								<div
									key={index}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "5px",
										backgroundColor: "var(--vscode-button-secondaryBackground)",
										padding: "2px 6px",
										borderRadius: "4px",
										border: "1px solid var(--vscode-button-secondaryBorder)",
										height: "24px",
									}}>
									<span>{cmd}</span>
									<VSCodeButton
										appearance="icon"
										style={{
											padding: 0,
											margin: 0,
											height: "20px",
											width: "20px",
											minWidth: "20px",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											color: "var(--vscode-button-foreground)",
										}}
										onClick={() => {
											const newCommands = (allowedCommands ?? []).filter((_, i) => i !== index)
											setAllowedCommands(newCommands)
											vscode.postMessage({
												type: "allowedCommands",
												commands: newCommands,
											})
										}}>
										<span className="codicon codicon-close" />
									</VSCodeButton>
								</div>
							))}
						</div>
					</SettingCheckbox>
				</div>

				<div
					style={{
						marginBottom: 15,
						marginTop: 10,
						paddingLeft: 10,
						borderLeft: "2px solid",
						borderColor: "var(--vscode-button-background)",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Browser Settings</h3>
					<SettingCombo
						name="Viewport size"
						description="Select the viewport size for browser interactions. This affects how websites are displayed and interacted with."
						value={browserViewportSize}
						onChange={setBrowserViewportSize}
						options={[
							{ value: "1280x800", label: "Large Desktop (1280x800)" },
							{ value: "900x600", label: "Small Desktop (900x600)" },
							{ value: "768x1024", label: "Tablet (768x1024)" },
							{ value: "360x640", label: "Mobile (360x640)" },
						]}
					/>

					<div style={{ marginBottom: 15 }}>
						<SettingSlider
							name="Screenshot quality"
							description="Adjust the WebP quality of browser screenshots. Higher values provide clearer screenshots but increase token usage."
							value={screenshotQuality ?? 75}
							onChange={setScreenshotQuality}
							min={1}
							max={100}
							step={1}
							unit="%"
						/>
					</div>
				</div>

				<div
					style={{
						marginBottom: 15,
						marginTop: 10,
						paddingLeft: 10,
						borderLeft: "2px solid",
						borderColor: "var(--vscode-button-background)",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Notification Settings</h3>
					<SettingCheckbox
						name="Enable sound effects"
						description="When enabled, Roo will play sound effects for notifications and events."
						checked={soundEnabled}
						onChange={setSoundEnabled}>
						<SettingSlider
							name="Volume"
							value={(soundVolume ?? 0.5) * 100}
							onChange={(value) => setSoundVolume(value / 100)}
							min={0}
							max={100}
							step={1}
							unit="%"
						/>
					</SettingCheckbox>
				</div>

				<div
					style={{
						marginBottom: 15,
						marginTop: 10,
						paddingLeft: 10,
						borderLeft: "2px solid",
						borderColor: "var(--vscode-button-background)",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: "0 0 15px 0" }}>Advanced Settings</h3>
					<SettingSlider
						name="Rate limit"
						description="Minimum time between API requests."
						value={rateLimitSeconds}
						onChange={setRateLimitSeconds}
						min={0}
						max={60}
						step={1}
						unit="s"
					/>
					<SettingSlider
						name="Terminal output limit"
						description="Maximum number of lines to include in terminal output when executing commands. When exceeded lines will be removed from the middle, saving tokens."
						value={terminalOutputLineLimit ?? 500}
						onChange={setTerminalOutputLineLimit}
						min={100}
						max={5000}
						step={100}
					/>
					<SettingSlider
						name="Open tabs context limit"
						description="Maximum number of VSCode open tabs to include in context. Higher values provide more context but increase token usage."
						value={maxOpenTabsContext ?? 20}
						onChange={setMaxOpenTabsContext}
						min={0}
						max={500}
						step={1}
					/>
					<SettingCheckbox
						name="Enable editing through diffs"
						description="When enabled, Roo will be able to edit files more quickly and will automatically reject truncated full-file writes. Works best with the latest Claude 3.5 Sonnet model."
						checked={diffEnabled}
						onChange={(checked) => {
							setDiffEnabled(checked)
							if (!checked) {
								// Reset experimental strategy when diffs are disabled
								setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, false)
							}
						}}>
						<SettingSlider
							name="Match precision"
							description="How precisely code sections must match when applying diffs. Lower values allow more flexible matching but increase the risk of incorrect replacements. Use values below 100% with extreme caution."
							value={(fuzzyMatchThreshold ?? 1.0) * 100}
							onChange={(value) => {
								setFuzzyMatchThreshold(value / 100)
							}}
							min={80}
							max={100}
							step={0.5}
							unit="%"
						/>
						<SettingCheckbox
							key={EXPERIMENT_IDS.DIFF_STRATEGY}
							{...experimentConfigsMap.DIFF_STRATEGY}
							checked={experiments[EXPERIMENT_IDS.DIFF_STRATEGY] ?? false}
							onChange={(enabled) => setExperimentEnabled(EXPERIMENT_IDS.DIFF_STRATEGY, enabled)}
							experimental={true}
						/>
					</SettingCheckbox>

					<SettingCheckbox
						name="Enable experimental checkpoints"
						description="When enabled, Roo will save a checkpoint whenever a file in the workspace is modified,
							added or deleted, letting you easily revert to a previous state."
						checked={checkpointsEnabled}
						onChange={(enabled) => {
							setCheckpointsEnabled(enabled)
						}}
						experimental={true}
					/>

					{Object.entries(experimentConfigsMap)
						.filter((config) => config[0] !== "DIFF_STRATEGY")
						.map((config) => (
							<SettingCheckbox
								key={config[0]}
								{...config[1]}
								checked={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
								experimental={true}
							/>
						))}
				</div>

				<div
					style={{
						textAlign: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
						lineHeight: "1.2",
						marginTop: "40px",
						padding: "10px 8px 15px 0px",
					}}>
					<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
						If you have any questions or feedback, feel free to open an issue at{" "}
						<VSCodeLink href="https://github.com/RooVetGit/Roo-Code" style={{ display: "inline" }}>
							github.com/RooVetGit/Roo-Code
						</VSCodeLink>{" "}
						or join{" "}
						<VSCodeLink href="https://www.reddit.com/r/RooCode/" style={{ display: "inline" }}>
							reddit.com/r/RooCode
						</VSCodeLink>
					</p>
					<p style={{ fontStyle: "italic", margin: "10px 0 0 0", padding: 0, marginBottom: 100 }}>
						v{version}
					</p>

					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						This will reset all global state and secret storage in the extension.
					</p>

					<VSCodeButton
						onClick={handleResetState}
						appearance="secondary"
						style={{ marginTop: "5px", width: "auto" }}>
						Reset State
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}

export default memo(SettingsView)
