import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Button } from "vscrui"
import { WebhookIcon } from "lucide-react"

import { ExperimentId } from "../../../../src/shared/experiments"
import { ApiConfiguration } from "../../../../src/shared/api"

import { vscode } from "@/utils/vscode"
import { ExtensionStateContextType, useExtensionState } from "@/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogCancel,
	AlertDialogAction,
	AlertDialogHeader,
	AlertDialogFooter,
} from "@/components/ui"

import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import ApiConfigManager from "./ApiConfigManager"
import ApiOptions from "./ApiOptions"
import { AutoApproveSettings } from "./AutoApproveSettings"
import { BrowserSettings } from "./BrowserSettings"
import { CheckpointSettings } from "./CheckpointSettings"
import { NotificationSettings } from "./NotificationSettings"
import { AdvancedSettings } from "./AdvancedSettings"
import { SettingsFooter } from "./SettingsFooter"
import { Section } from "./Section"

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}

type SettingsViewProps = {
	onDone: () => void
}

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>(({ onDone }, ref) => {
	const extensionState = useExtensionState()
	const { currentApiConfigName, listApiConfigMeta, uriScheme, version } = extensionState

	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const [isChangeDetected, setChangeDetected] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const prevApiConfigName = useRef(currentApiConfigName)
	const confirmDialogHandler = useRef<() => void>()

	const [cachedState, setCachedState] = useState(extensionState)

	const {
		alwaysAllowReadOnly,
		allowedCommands,
		alwaysAllowBrowser,
		alwaysAllowExecute,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowWrite,
		alwaysApproveResubmit,
		browserToolEnabled,
		browserViewportSize,
		enableCheckpoints,
		checkpointStorage,
		diffEnabled,
		experiments,
		fuzzyMatchThreshold,
		maxOpenTabsContext,
		mcpEnabled,
		rateLimitSeconds,
		requestDelaySeconds,
		screenshotQuality,
		soundEnabled,
		soundVolume,
		terminalOutputLineLimit,
		writeDelayMs,
	} = cachedState

	// Make sure apiConfiguration is initialized and managed by SettingsView.
	const apiConfiguration = useMemo(() => cachedState.apiConfiguration ?? {}, [cachedState.apiConfiguration])

	useEffect(() => {
		// Update only when currentApiConfigName is changed.
		// Expected to be triggered by loadApiConfiguration/upsertApiConfiguration.
		if (prevApiConfigName.current === currentApiConfigName) {
			return
		}

		setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
		prevApiConfigName.current = currentApiConfigName
		console.log("useEffect: currentApiConfigName changed, setChangeDetected -> false")
		setChangeDetected(false)
	}, [currentApiConfigName, extensionState, isChangeDetected])

	const setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType> = useCallback((field, value) => {
		setCachedState((prevState) => {
			if (prevState[field] === value) {
				return prevState
			}

			console.log(`setCachedStateField(${field} -> ${value}): setChangeDetected -> true`)
			setChangeDetected(true)
			return { ...prevState, [field]: value }
		})
	}, [])

	const setApiConfigurationField = useCallback(
		<K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => {
			setCachedState((prevState) => {
				if (prevState.apiConfiguration?.[field] === value) {
					return prevState
				}

				console.log(`setApiConfigurationField(${field} -> ${value}): setChangeDetected -> true`)
				setChangeDetected(true)

				return { ...prevState, apiConfiguration: { ...prevState.apiConfiguration, [field]: value } }
			})
		},
		[],
	)

	const setExperimentEnabled: SetExperimentEnabled = useCallback((id: ExperimentId, enabled: boolean) => {
		setCachedState((prevState) => {
			if (prevState.experiments?.[id] === enabled) {
				return prevState
			}

			console.log("setExperimentEnabled: setChangeDetected -> true")
			setChangeDetected(true)

			return {
				...prevState,
				experiments: { ...prevState.experiments, [id]: enabled },
			}
		})
	}, [])

	const isSettingValid = !errorMessage

	const handleSubmit = () => {
		if (isSettingValid) {
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "alwaysAllowWrite", bool: alwaysAllowWrite })
			vscode.postMessage({ type: "alwaysAllowExecute", bool: alwaysAllowExecute })
			vscode.postMessage({ type: "alwaysAllowBrowser", bool: alwaysAllowBrowser })
			vscode.postMessage({ type: "alwaysAllowMcp", bool: alwaysAllowMcp })
			vscode.postMessage({ type: "allowedCommands", commands: allowedCommands ?? [] })
			vscode.postMessage({ type: "browserToolEnabled", bool: browserToolEnabled })
			vscode.postMessage({ type: "soundEnabled", bool: soundEnabled })
			vscode.postMessage({ type: "soundVolume", value: soundVolume })
			vscode.postMessage({ type: "diffEnabled", bool: diffEnabled })
			vscode.postMessage({ type: "enableCheckpoints", bool: enableCheckpoints })
			vscode.postMessage({ type: "checkpointStorage", text: checkpointStorage })
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
			vscode.postMessage({ type: "updateExperimental", values: experiments })
			vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: alwaysAllowModeSwitch })
			vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
			console.log("handleSubmit: setChangeDetected -> false", apiConfiguration)
			setChangeDetected(false)
		}
	}

	const checkUnsaveChanges = useCallback(
		(then: () => void) => {
			if (isChangeDetected) {
				confirmDialogHandler.current = then
				setDiscardDialogShow(true)
			} else {
				then()
			}
		},
		[isChangeDetected],
	)

	useImperativeHandle(ref, () => ({ checkUnsaveChanges }), [checkUnsaveChanges])

	const onConfirmDialogResult = useCallback((confirm: boolean) => {
		if (confirm) {
			confirmDialogHandler.current?.()
		}
	}, [])

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<div className="flex justify-between items-center px-5 py-2.5 border-b border-vscode-panel-border">
				<h3 className="text-vscode-foreground m-0">Settings</h3>
				<div className="flex gap-2">
					<Button
						appearance={isSettingValid ? "primary" : "secondary"}
						className={!isSettingValid ? "!border-vscode-errorForeground" : ""}
						title={!isSettingValid ? errorMessage : isChangeDetected ? "Save changes" : "Nothing changed"}
						onClick={handleSubmit}
						disabled={!isChangeDetected || !isSettingValid}>
						Save
					</Button>
					<VSCodeButton
						appearance="secondary"
						title="Discard unsaved changes and close settings panel"
						onClick={() => checkUnsaveChanges(onDone)}>
						Done
					</VSCodeButton>
				</div>
			</div>

			<div className="flex flex-col flex-1 overflow-auto divide-y divide-vscode-panel-border">
				<div>
					<SectionHeader>
						<div className="flex items-center gap-2">
							<WebhookIcon className="w-4" />
							<div>Providers</div>
						</div>
					</SectionHeader>

					<Section>
						<ApiConfigManager
							currentApiConfigName={currentApiConfigName}
							listApiConfigMeta={listApiConfigMeta}
							onSelectConfig={(configName: string) =>
								checkUnsaveChanges(() =>
									vscode.postMessage({ type: "loadApiConfiguration", text: configName }),
								)
							}
							onDeleteConfig={(configName: string) =>
								vscode.postMessage({ type: "deleteApiConfiguration", text: configName })
							}
							onRenameConfig={(oldName: string, newName: string) => {
								vscode.postMessage({
									type: "renameApiConfiguration",
									values: { oldName, newName },
									apiConfiguration,
								})
								prevApiConfigName.current = newName
							}}
							onUpsertConfig={(configName: string) =>
								vscode.postMessage({
									type: "upsertApiConfiguration",
									text: configName,
									apiConfiguration,
								})
							}
						/>
						<ApiOptions
							uriScheme={uriScheme}
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
						/>
					</Section>
				</div>

				<AutoApproveSettings
					alwaysAllowReadOnly={alwaysAllowReadOnly}
					alwaysAllowWrite={alwaysAllowWrite}
					writeDelayMs={writeDelayMs}
					alwaysAllowBrowser={alwaysAllowBrowser}
					alwaysApproveResubmit={alwaysApproveResubmit}
					requestDelaySeconds={requestDelaySeconds}
					alwaysAllowMcp={alwaysAllowMcp}
					alwaysAllowModeSwitch={alwaysAllowModeSwitch}
					alwaysAllowExecute={alwaysAllowExecute}
					allowedCommands={allowedCommands}
					setCachedStateField={setCachedStateField}
				/>

				<BrowserSettings
					browserToolEnabled={browserToolEnabled}
					browserViewportSize={browserViewportSize}
					screenshotQuality={screenshotQuality}
					setCachedStateField={setCachedStateField}
				/>

				<CheckpointSettings
					enableCheckpoints={enableCheckpoints}
					checkpointStorage={checkpointStorage}
					setCachedStateField={setCachedStateField}
				/>

				<NotificationSettings
					soundEnabled={soundEnabled}
					soundVolume={soundVolume}
					setCachedStateField={setCachedStateField}
				/>

				<AdvancedSettings
					rateLimitSeconds={rateLimitSeconds}
					terminalOutputLineLimit={terminalOutputLineLimit}
					maxOpenTabsContext={maxOpenTabsContext}
					diffEnabled={diffEnabled}
					fuzzyMatchThreshold={fuzzyMatchThreshold}
					setCachedStateField={setCachedStateField}
					setExperimentEnabled={setExperimentEnabled}
					experiments={experiments}
				/>

				<SettingsFooter version={version} />
			</div>

			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unsaved changes</AlertDialogTitle>
						<AlertDialogDescription>
							<span className={`codicon codicon-warning align-middle mr-1`} />
							Do you want to discard changes and continue?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>Yes</AlertDialogAction>
						<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>No</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
})

export default memo(SettingsView)
