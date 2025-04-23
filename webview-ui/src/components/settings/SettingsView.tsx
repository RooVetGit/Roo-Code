import React, {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	WheelEvent,
} from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	CheckCheck,
	SquareMousePointer,
	Webhook,
	GitBranch,
	Bell,
	Database,
	SquareTerminal,
	FlaskConical,
	AlertTriangle,
	Globe,
	Info,
	LucideIcon,
	MoreHorizontal,
} from "lucide-react"

import { ExperimentId } from "@roo/shared/experiments"
import { TelemetrySetting } from "@roo/shared/TelemetrySetting"
import { ApiConfiguration } from "@roo/shared/api"

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
	Button,
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui"

import { Tab, TabContent, TabHeader, TabList, TabTrigger } from "../common/Tab"
import { SetCachedStateField, SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import ApiConfigManager from "./ApiConfigManager"
import ApiOptions from "./ApiOptions"
import { AutoApproveSettings } from "./AutoApproveSettings"
import { BrowserSettings } from "./BrowserSettings"
import { CheckpointSettings } from "./CheckpointSettings"
import { NotificationSettings } from "./NotificationSettings"
import { ContextManagementSettings } from "./ContextManagementSettings"
import { TerminalSettings } from "./TerminalSettings"
import { ExperimentalSettings } from "./ExperimentalSettings"
import { LanguageSettings } from "./LanguageSettings"
import { About } from "./About"
import { Section } from "./Section"
import { cn } from "@/lib/utils"
import {
	settingsTabsContainer,
	settingsTabList,
	settingsTabTrigger,
	settingsTabTriggerActive,
	scrollbarHideClasses,
} from "./styles"

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}

const sectionNames = [
	"providers",
	"autoApprove",
	"browser",
	"checkpoints",
	"notifications",
	"contextManagement",
	"terminal",
	"experimental",
	"language",
	"about",
] as const

type SectionName = (typeof sectionNames)[number]

type SettingsViewProps = {
	onDone: () => void
	targetSection?: string
}

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>(({ onDone, targetSection }, ref) => {
	const { t } = useAppTranslation()

	const extensionState = useExtensionState()
	const { currentApiConfigName, listApiConfigMeta, uriScheme, version, settingsImportedAt } = extensionState

	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const [isChangeDetected, setChangeDetected] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [activeTab, setActiveTab] = useState<SectionName>(
		targetSection && sectionNames.includes(targetSection as SectionName)
			? (targetSection as SectionName)
			: "providers",
	)

	const prevApiConfigName = useRef(currentApiConfigName)
	const confirmDialogHandler = useRef<() => void>()

	const [cachedState, setCachedState] = useState(extensionState)
	const scrollContainerRef = useRef<HTMLDivElement>(null) // Ref for the scrollable container

	const {
		alwaysAllowReadOnly,
		alwaysAllowReadOnlyOutsideWorkspace,
		allowedCommands,
		language,
		alwaysAllowBrowser,
		alwaysAllowExecute,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowWrite,
		alwaysAllowWriteOutsideWorkspace,
		alwaysApproveResubmit,
		browserToolEnabled,
		browserViewportSize,
		enableCheckpoints,
		diffEnabled,
		experiments,
		fuzzyMatchThreshold,
		maxOpenTabsContext,
		maxWorkspaceFiles,
		mcpEnabled,
		requestDelaySeconds,
		remoteBrowserHost,
		screenshotQuality,
		soundEnabled,
		ttsEnabled,
		ttsSpeed,
		soundVolume,
		telemetrySetting,
		terminalOutputLineLimit,
		terminalShellIntegrationTimeout,
		terminalCommandDelay,
		terminalPowershellCounter,
		terminalZshClearEolMark,
		terminalZshOhMy,
		terminalZshP10k,
		terminalZdotdir,
		writeDelayMs,
		showRooIgnoredFiles,
		remoteBrowserEnabled,
		maxReadFileLine,
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
		setChangeDetected(false)
	}, [currentApiConfigName, extensionState, isChangeDetected])

	// Bust the cache when settings are imported.
	useEffect(() => {
		if (settingsImportedAt) {
			setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
			setChangeDetected(false)
		}
	}, [settingsImportedAt, extensionState])

	const setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType> = useCallback((field, value) => {
		setCachedState((prevState) => {
			if (prevState[field] === value) {
				return prevState
			}

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

			setChangeDetected(true)
			return { ...prevState, experiments: { ...prevState.experiments, [id]: enabled } }
		})
	}, [])

	const setTelemetrySetting = useCallback((setting: TelemetrySetting) => {
		setCachedState((prevState) => {
			if (prevState.telemetrySetting === setting) {
				return prevState
			}

			setChangeDetected(true)
			return { ...prevState, telemetrySetting: setting }
		})
	}, [])

	const isSettingValid = !errorMessage

	const handleSubmit = () => {
		if (isSettingValid) {
			vscode.postMessage({ type: "language", text: language })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({
				type: "alwaysAllowReadOnlyOutsideWorkspace",
				bool: alwaysAllowReadOnlyOutsideWorkspace,
			})
			vscode.postMessage({ type: "alwaysAllowWrite", bool: alwaysAllowWrite })
			vscode.postMessage({ type: "alwaysAllowWriteOutsideWorkspace", bool: alwaysAllowWriteOutsideWorkspace })
			vscode.postMessage({ type: "alwaysAllowExecute", bool: alwaysAllowExecute })
			vscode.postMessage({ type: "alwaysAllowBrowser", bool: alwaysAllowBrowser })
			vscode.postMessage({ type: "alwaysAllowMcp", bool: alwaysAllowMcp })
			vscode.postMessage({ type: "allowedCommands", commands: allowedCommands ?? [] })
			vscode.postMessage({ type: "browserToolEnabled", bool: browserToolEnabled })
			vscode.postMessage({ type: "soundEnabled", bool: soundEnabled })
			vscode.postMessage({ type: "ttsEnabled", bool: ttsEnabled })
			vscode.postMessage({ type: "ttsSpeed", value: ttsSpeed })
			vscode.postMessage({ type: "soundVolume", value: soundVolume })
			vscode.postMessage({ type: "diffEnabled", bool: diffEnabled })
			vscode.postMessage({ type: "enableCheckpoints", bool: enableCheckpoints })
			vscode.postMessage({ type: "browserViewportSize", text: browserViewportSize })
			vscode.postMessage({ type: "remoteBrowserHost", text: remoteBrowserHost })
			vscode.postMessage({ type: "remoteBrowserEnabled", bool: remoteBrowserEnabled })
			vscode.postMessage({ type: "fuzzyMatchThreshold", value: fuzzyMatchThreshold ?? 1.0 })
			vscode.postMessage({ type: "writeDelayMs", value: writeDelayMs })
			vscode.postMessage({ type: "screenshotQuality", value: screenshotQuality ?? 75 })
			vscode.postMessage({ type: "terminalOutputLineLimit", value: terminalOutputLineLimit ?? 500 })
			vscode.postMessage({ type: "terminalShellIntegrationTimeout", value: terminalShellIntegrationTimeout })
			vscode.postMessage({ type: "terminalCommandDelay", value: terminalCommandDelay })
			vscode.postMessage({ type: "terminalPowershellCounter", bool: terminalPowershellCounter })
			vscode.postMessage({ type: "terminalZshClearEolMark", bool: terminalZshClearEolMark })
			vscode.postMessage({ type: "terminalZshOhMy", bool: terminalZshOhMy })
			vscode.postMessage({ type: "terminalZshP10k", bool: terminalZshP10k })
			vscode.postMessage({ type: "terminalZdotdir", bool: terminalZdotdir })
			vscode.postMessage({ type: "mcpEnabled", bool: mcpEnabled })
			vscode.postMessage({ type: "alwaysApproveResubmit", bool: alwaysApproveResubmit })
			vscode.postMessage({ type: "requestDelaySeconds", value: requestDelaySeconds })
			vscode.postMessage({ type: "maxOpenTabsContext", value: maxOpenTabsContext })
			vscode.postMessage({ type: "maxWorkspaceFiles", value: maxWorkspaceFiles ?? 200 })
			vscode.postMessage({ type: "showRooIgnoredFiles", bool: showRooIgnoredFiles })
			vscode.postMessage({ type: "maxReadFileLine", value: maxReadFileLine ?? 500 })
			vscode.postMessage({ type: "currentApiConfigName", text: currentApiConfigName })
			vscode.postMessage({ type: "updateExperimental", values: experiments })
			vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: alwaysAllowModeSwitch })
			vscode.postMessage({ type: "alwaysAllowSubtasks", bool: alwaysAllowSubtasks })
			vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
			vscode.postMessage({ type: "telemetrySetting", text: telemetrySetting })
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

	// Handle tab changes with unsaved changes check
	const handleTabChange = useCallback(
		(newTab: SectionName) => {
			if (isChangeDetected) {
				confirmDialogHandler.current = () => setActiveTab(newTab)
				setDiscardDialogShow(true)
			} else {
				setActiveTab(newTab)
			}
		},
		[isChangeDetected],
	)

	// Create refs for each tab
	const tabRefs = useRef<Record<SectionName, React.RefObject<HTMLButtonElement>>>({} as any)

	// Initialize refs for each section
	useEffect(() => {
		sectionNames.forEach((name) => {
			if (!tabRefs.current[name]) {
				tabRefs.current[name] = React.createRef<HTMLButtonElement>()
			}
		})
	}, [])

	const sections: { id: SectionName; icon: LucideIcon; ref: React.RefObject<HTMLButtonElement> }[] = useMemo(
		() => [
			{ id: "providers", icon: Webhook, ref: tabRefs.current.providers || React.createRef() },
			{ id: "autoApprove", icon: CheckCheck, ref: tabRefs.current.autoApprove || React.createRef() },
			{ id: "browser", icon: SquareMousePointer, ref: tabRefs.current.browser || React.createRef() },
			{ id: "checkpoints", icon: GitBranch, ref: tabRefs.current.checkpoints || React.createRef() },
			{ id: "notifications", icon: Bell, ref: tabRefs.current.notifications || React.createRef() },
			{ id: "contextManagement", icon: Database, ref: tabRefs.current.contextManagement || React.createRef() },
			{ id: "terminal", icon: SquareTerminal, ref: tabRefs.current.terminal || React.createRef() },
			{ id: "experimental", icon: FlaskConical, ref: tabRefs.current.experimental || React.createRef() },
			{ id: "language", icon: Globe, ref: tabRefs.current.language || React.createRef() },
			{ id: "about", icon: Info, ref: tabRefs.current.about || React.createRef() },
		],
		[tabRefs],
	)

	// Update target section logic to set active tab
	useEffect(() => {
		if (targetSection && sectionNames.includes(targetSection as SectionName)) {
			setActiveTab(targetSection as SectionName)
		}
	}, [targetSection])

	// Add effect to conditionally scroll the active tab into view when it changes
	useEffect(() => {
		const activeTabElement = tabRefs.current[activeTab]?.current
		const containerElement = scrollContainerRef.current

		if (activeTabElement && containerElement) {
			// Calculate the visible range within the scroll container
			const visibleLeft = containerElement.scrollLeft
			const visibleRight = containerElement.scrollLeft + containerElement.clientWidth

			// Calculate the tab's position within the scroll container
			const tabLeft = activeTabElement.offsetLeft
			const tabRight = activeTabElement.offsetLeft + activeTabElement.offsetWidth

			// Check if the tab is fully within the visible range
			const isVisible = tabLeft >= visibleLeft && tabRight <= visibleRight

			// Only scroll if the tab is not fully visible
			if (!isVisible) {
				activeTabElement.scrollIntoView({
					behavior: "auto", // Use instant scrolling
					block: "nearest",
					inline: "center",
				})
			}
		}
	}, [activeTab])

	// Handle horizontal scrolling with mouse wheel
	const handleWheelScroll = useCallback((event: WheelEvent<HTMLDivElement>) => {
		const container = scrollContainerRef.current
		if (container) {
			// Use deltaY for vertical scroll wheels (most common)
			// Adjust sensitivity as needed
			const scrollAmount = event.deltaY * 2 // Multiplier for sensitivity

			// Check if scrolling is possible
			if (container.scrollWidth > container.clientWidth) {
				container.scrollLeft += scrollAmount
				// Prevent default page scrolling if horizontal scroll happened
				if (
					(scrollAmount < 0 && container.scrollLeft > 0) ||
					(scrollAmount > 0 && container.scrollLeft < container.scrollWidth - container.clientWidth)
				) {
					event.preventDefault()
				}
			}
		}
	}, [])

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<div className="flex items-center gap-1">
					<h3 className="text-vscode-foreground m-0">{t("settings:header.title")}</h3>
				</div>
				<div className="flex gap-2">
					<Button
						variant={isSettingValid ? "default" : "secondary"}
						className={!isSettingValid ? "!border-vscode-errorForeground" : ""}
						title={
							!isSettingValid
								? errorMessage
								: isChangeDetected
									? t("settings:header.saveButtonTooltip")
									: t("settings:header.nothingChangedTooltip")
						}
						onClick={handleSubmit}
						disabled={!isChangeDetected || !isSettingValid}
						data-testid="save-button">
						{t("settings:common.save")}
					</Button>
					<Button
						variant="secondary"
						title={t("settings:header.doneButtonTooltip")}
						onClick={() => checkUnsaveChanges(onDone)}>
						{t("settings:common.done")}
					</Button>
				</div>
			</TabHeader>

			{/* Tab list with overflow dropdown */}
			<div className="flex items-center px-5">
				{" "}
				{/* Changed pr-5 to px-5 */}
				{/* Scrollable tab container */}
				<div
					ref={scrollContainerRef} // Assign ref
					className={cn(settingsTabsContainer, scrollbarHideClasses, "w-full")} // Removed px-5
					onWheel={handleWheelScroll} // Add wheel handler
				>
					<TabList
						value={activeTab}
						onValueChange={(value) => handleTabChange(value as SectionName)}
						className={cn(settingsTabList, "w-full min-w-max")}
						data-testid="settings-tab-list">
						{sections.map(({ id, icon: Icon, ref }) => (
							<TabTrigger
								key={id}
								ref={ref}
								value={id}
								className={cn(
									activeTab === id
										? `${settingsTabTrigger} ${settingsTabTriggerActive}`
										: settingsTabTrigger,
									"flex-shrink-0", // Prevent tabs from shrinking
									"focus:ring-0", // Remove the focus ring styling
								)}
								data-testid={`tab-${id}`}>
								<div className="flex items-center gap-2">
									<Icon className="w-4 h-4" />
									<span>{t(`settings:sections.${id}`)}</span>
								</div>
							</TabTrigger>
						))}
					</TabList>
				</div>
				{/* "More" dropdown button - always show it */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="ml-1 h-8 w-8 rounded-md flex-shrink-0"
							aria-label={t("settings:common.more")}
							data-testid="more-tabs-button">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{sections.map(({ id, icon: Icon }) => (
							<DropdownMenuItem
								key={id}
								onClick={() => handleTabChange(id)}
								className={cn(
									activeTab === id ? "bg-vscode-list-activeSelectionBackground" : "",
									"focus:ring-0 focus:outline-none", // Remove the focus ring styling
								)}
								data-testid={`dropdown-tab-${id}`}>
								<Icon className="mr-2 h-4 w-4" />
								<span>{t(`settings:sections.${id}`)}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<TabContent className="p-0">
				{/* Providers Section */}
				{activeTab === "providers" && (
					<div>
						<SectionHeader>
							<div className="flex items-center gap-2">
								<Webhook className="w-4" />
								<div>{t("settings:sections.providers")}</div>
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
				)}

				{/* Auto-Approve Section */}
				{activeTab === "autoApprove" && (
					<AutoApproveSettings
						alwaysAllowReadOnly={alwaysAllowReadOnly}
						alwaysAllowReadOnlyOutsideWorkspace={alwaysAllowReadOnlyOutsideWorkspace}
						alwaysAllowWrite={alwaysAllowWrite}
						alwaysAllowWriteOutsideWorkspace={alwaysAllowWriteOutsideWorkspace}
						writeDelayMs={writeDelayMs}
						alwaysAllowBrowser={alwaysAllowBrowser}
						alwaysApproveResubmit={alwaysApproveResubmit}
						requestDelaySeconds={requestDelaySeconds}
						alwaysAllowMcp={alwaysAllowMcp}
						alwaysAllowModeSwitch={alwaysAllowModeSwitch}
						alwaysAllowSubtasks={alwaysAllowSubtasks}
						alwaysAllowExecute={alwaysAllowExecute}
						allowedCommands={allowedCommands}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Browser Section */}
				{activeTab === "browser" && (
					<BrowserSettings
						browserToolEnabled={browserToolEnabled}
						browserViewportSize={browserViewportSize}
						screenshotQuality={screenshotQuality}
						remoteBrowserHost={remoteBrowserHost}
						remoteBrowserEnabled={remoteBrowserEnabled}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Checkpoints Section */}
				{activeTab === "checkpoints" && (
					<CheckpointSettings
						enableCheckpoints={enableCheckpoints}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Notifications Section */}
				{activeTab === "notifications" && (
					<NotificationSettings
						ttsEnabled={ttsEnabled}
						ttsSpeed={ttsSpeed}
						soundEnabled={soundEnabled}
						soundVolume={soundVolume}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Context Management Section */}
				{activeTab === "contextManagement" && (
					<ContextManagementSettings
						maxOpenTabsContext={maxOpenTabsContext}
						maxWorkspaceFiles={maxWorkspaceFiles ?? 200}
						showRooIgnoredFiles={showRooIgnoredFiles}
						maxReadFileLine={maxReadFileLine}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Terminal Section */}
				{activeTab === "terminal" && (
					<TerminalSettings
						terminalOutputLineLimit={terminalOutputLineLimit}
						terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
						terminalCommandDelay={terminalCommandDelay}
						terminalPowershellCounter={terminalPowershellCounter}
						terminalZshClearEolMark={terminalZshClearEolMark}
						terminalZshOhMy={terminalZshOhMy}
						terminalZshP10k={terminalZshP10k}
						terminalZdotdir={terminalZdotdir}
						setCachedStateField={setCachedStateField}
					/>
				)}

				{/* Experimental Section */}
				{activeTab === "experimental" && (
					<ExperimentalSettings
						setCachedStateField={setCachedStateField}
						setExperimentEnabled={setExperimentEnabled}
						experiments={experiments}
					/>
				)}

				{/* Language Section */}
				{activeTab === "language" && (
					<LanguageSettings language={language || "en"} setCachedStateField={setCachedStateField} />
				)}

				{/* About Section */}
				{activeTab === "about" && (
					<About
						version={version}
						telemetrySetting={telemetrySetting}
						setTelemetrySetting={setTelemetrySetting}
					/>
				)}
			</TabContent>

			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<AlertTriangle className="w-5 h-5 text-yellow-500" />
							{t("settings:unsavedChangesDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:unsavedChangesDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
							{t("settings:unsavedChangesDialog.cancelButton")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
							{t("settings:unsavedChangesDialog.discardButton")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tab>
	)
})

export default memo(SettingsView)
