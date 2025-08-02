import React from "react"
import { ChevronUp, Check, X, Upload, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip, Button } from "@/components/ui"
import { IconButton } from "./IconButton"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Mode, getAllModes } from "@roo/modes"
import { ModeConfig, CustomModePrompts } from "@roo-code/types"
import { telemetryClient } from "@/utils/TelemetryClient"
import { TelemetryEventName } from "@roo-code/types"
import { Fzf } from "fzf"

// Minimum number of modes required to show search functionality
const SEARCH_THRESHOLD = 6

interface ModeSelectorProps {
	value: Mode
	onChange: (value: Mode) => void
	disabled?: boolean
	title?: string
	triggerClassName?: string
	modeShortcutText: string
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	disableSearch?: boolean
}

export const ModeSelector = ({
	value,
	onChange,
	disabled = false,
	title = "",
	triggerClassName = "",
	modeShortcutText,
	customModes,
	customModePrompts,
	disableSearch = false,
}: ModeSelectorProps) => {
	const [open, setOpen] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState("")
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const portalContainer = useRooPortal("roo-portal")
	const { hasOpenedModeSelector, setHasOpenedModeSelector } = useExtensionState()
	const { t } = useAppTranslation()

	// Export/Import state
	const [isExporting, setIsExporting] = React.useState<string | null>(null)
	const [isImporting, setIsImporting] = React.useState(false)
	const [showImportDialog, setShowImportDialog] = React.useState(false)
	const [exportError, setExportError] = React.useState<string | null>(null)
	const [importError, setImportError] = React.useState<string | null>(null)
	const [selectedImportLevel, setSelectedImportLevel] = React.useState<"project" | "global">("project")

	const trackModeSelectorOpened = React.useCallback(() => {
		// Track telemetry every time the mode selector is opened
		telemetryClient.capture(TelemetryEventName.MODE_SELECTOR_OPENED)

		// Track first-time usage for UI purposes
		if (!hasOpenedModeSelector) {
			setHasOpenedModeSelector(true)
			vscode.postMessage({ type: "hasOpenedModeSelector", bool: true })
		}
	}, [hasOpenedModeSelector, setHasOpenedModeSelector])

	// Get all modes including custom modes and merge custom prompt descriptions
	const modes = React.useMemo(() => {
		const allModes = getAllModes(customModes)
		return allModes.map((mode) => ({
			...mode,
			description: customModePrompts?.[mode.slug]?.description ?? mode.description,
		}))
	}, [customModes, customModePrompts])

	// Find the selected mode
	const selectedMode = React.useMemo(() => modes.find((mode) => mode.slug === value), [modes, value])

	// Memoize searchable items for fuzzy search with separate name and description search
	const nameSearchItems = React.useMemo(() => {
		return modes.map((mode) => ({
			original: mode,
			searchStr: [mode.name, mode.slug].filter(Boolean).join(" "),
		}))
	}, [modes])

	const descriptionSearchItems = React.useMemo(() => {
		return modes.map((mode) => ({
			original: mode,
			searchStr: mode.description || "",
		}))
	}, [modes])

	// Create memoized Fzf instances for name and description searches
	const nameFzfInstance = React.useMemo(() => {
		return new Fzf(nameSearchItems, {
			selector: (item) => item.searchStr,
		})
	}, [nameSearchItems])

	const descriptionFzfInstance = React.useMemo(() => {
		return new Fzf(descriptionSearchItems, {
			selector: (item) => item.searchStr,
		})
	}, [descriptionSearchItems])

	// Filter modes based on search value using fuzzy search with priority
	const filteredModes = React.useMemo(() => {
		if (!searchValue) return modes

		// First search in names/slugs
		const nameMatches = nameFzfInstance.find(searchValue)
		const nameMatchedModes = new Set(nameMatches.map((result) => result.item.original.slug))

		// Then search in descriptions
		const descriptionMatches = descriptionFzfInstance.find(searchValue)

		// Combine results: name matches first, then description matches
		const combinedResults = [
			...nameMatches.map((result) => result.item.original),
			...descriptionMatches
				.filter((result) => !nameMatchedModes.has(result.item.original.slug))
				.map((result) => result.item.original),
		]

		return combinedResults
	}, [modes, searchValue, nameFzfInstance, descriptionFzfInstance])

	const onClearSearch = React.useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	const handleSelect = React.useCallback(
		(modeSlug: string) => {
			onChange(modeSlug as Mode)
			setOpen(false)
			// Clear search after selection
			setSearchValue("")
		},
		[onChange],
	)

	const onOpenChange = React.useCallback(
		(isOpen: boolean) => {
			if (isOpen) trackModeSelectorOpened()
			setOpen(isOpen)
			// Clear search when closing
			if (!isOpen) {
				setSearchValue("")
			}
		},
		[trackModeSelectorOpened],
	)

	// Auto-focus search input when popover opens
	React.useEffect(() => {
		if (open && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [open])

	// Handle export/import message responses
	React.useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			// Only handle messages that are specifically for mode export/import
			if (!message || typeof message !== "object") return

			if (message.type === "exportModeResult") {
				setIsExporting(null)
				if (!message.success) {
					console.error("Failed to export mode:", message.error)
					setExportError(message.error || t("prompts:exportMode.error"))
					// Clear error after 5 seconds
					setTimeout(() => setExportError(null), 5000)
				} else {
					setExportError(null)
				}
			} else if (message.type === "importModeResult") {
				setIsImporting(false)
				if (!message.success && message.error !== "cancelled") {
					console.error("Failed to import mode:", message.error)
					setImportError(message.error || t("prompts:importMode.error"))
				} else {
					setImportError(null)
					setShowImportDialog(false)
				}
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [t])

	// Handle export mode
	const handleExportMode = React.useCallback((modeSlug: string) => {
		setIsExporting(modeSlug)
		setExportError(null)
		vscode.postMessage({
			type: "exportMode",
			slug: modeSlug,
		})
	}, [])

	// Handle import mode
	const handleImportMode = React.useCallback(() => {
		setIsImporting(true)
		setImportError(null)
		vscode.postMessage({
			type: "importMode",
			source: selectedImportLevel,
		})
	}, [selectedImportLevel])

	// Determine if search should be shown
	const showSearch = !disableSearch && modes.length > SEARCH_THRESHOLD

	// Combine instruction text for tooltip
	const instructionText = `${t("chat:modeSelector.description")} ${modeShortcutText}`

	const trigger = (
		<PopoverTrigger
			disabled={disabled}
			data-testid="mode-selector-trigger"
			className={cn(
				"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
				"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
				"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
				disabled
					? "opacity-50 cursor-not-allowed"
					: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
				triggerClassName,
				!disabled && !hasOpenedModeSelector
					? "bg-primary opacity-90 hover:bg-primary-hover text-vscode-button-foreground"
					: null,
			)}>
			<ChevronUp className="pointer-events-none opacity-80 flex-shrink-0 size-3" />
			<span className="truncate">{selectedMode?.name || ""}</span>
		</PopoverTrigger>
	)

	return (
		<>
			<Popover open={open} onOpenChange={onOpenChange} data-testid="mode-selector-root">
				{title ? <StandardTooltip content={title}>{trigger}</StandardTooltip> : trigger}

				<PopoverContent
					align="start"
					sideOffset={4}
					container={portalContainer}
					className="p-0 overflow-hidden min-w-80 max-w-9/10">
					<div className="flex flex-col w-full">
						{/* Show search bar only when there are more than SEARCH_THRESHOLD items, otherwise show info blurb */}
						{showSearch ? (
							<div className="relative p-2 border-b border-vscode-dropdown-border">
								<input
									aria-label="Search modes"
									ref={searchInputRef}
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									placeholder={t("chat:modeSelector.searchPlaceholder")}
									className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
									data-testid="mode-search-input"
								/>
								{searchValue.length > 0 && (
									<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
										<X
											className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
											onClick={onClearSearch}
										/>
									</div>
								)}
							</div>
						) : (
							<div className="p-3 border-b border-vscode-dropdown-border">
								<p className="m-0 text-xs text-vscode-descriptionForeground">{instructionText}</p>
							</div>
						)}

						{/* Mode List */}
						<div className="max-h-[300px] overflow-y-auto">
							{filteredModes.length === 0 && searchValue ? (
								<div className="py-2 px-3 text-sm text-vscode-foreground/70">
									{t("chat:modeSelector.noResults")}
								</div>
							) : (
								<div className="py-1">
									{filteredModes.map((mode) => (
										<div
											key={mode.slug}
											className={cn(
												"px-3 py-1.5 text-sm flex items-center group",
												"hover:bg-vscode-list-hoverBackground",
												mode.slug === value
													? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
													: "",
											)}
											data-testid="mode-selector-item">
											<div
												className="flex-1 min-w-0 cursor-pointer"
												onClick={() => handleSelect(mode.slug)}>
												<div className="font-bold truncate">{mode.name}</div>
												{mode.description && (
													<div className="text-xs text-vscode-descriptionForeground truncate">
														{mode.description}
													</div>
												)}
											</div>
											<div className="flex items-center gap-1 ml-2">
												{/* Export button - show on hover or when exporting */}
												<Button
													variant="ghost"
													size="icon"
													className={cn(
														"h-6 w-6 p-0.5",
														isExporting !== mode.slug &&
															"opacity-0 group-hover:opacity-100",
														"transition-opacity",
													)}
													onClick={(e) => {
														e.stopPropagation()
														handleExportMode(mode.slug)
													}}
													disabled={isExporting === mode.slug}
													aria-label={t("prompts:exportMode.title")}
													title={t("prompts:exportMode.title")}>
													<Upload className="h-3.5 w-3.5" />
												</Button>
												{mode.slug === value && <Check className="size-4 p-0.5" />}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Export error message */}
						{exportError && (
							<div className="px-3 py-2 text-xs text-vscode-errorForeground border-t border-vscode-dropdown-border">
								{exportError}
							</div>
						)}

						{/* Bottom bar with buttons on left and title on right */}
						<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
							<div className="flex flex-row gap-1">
								<IconButton
									iconClass="codicon-extensions"
									title={t("chat:modeSelector.marketplace")}
									onClick={() => {
										window.postMessage(
											{
												type: "action",
												action: "marketplaceButtonClicked",
												values: { marketplaceTab: "mode" },
											},
											"*",
										)
										setOpen(false)
									}}
								/>
								<IconButton
									iconClass="codicon-settings-gear"
									title={t("chat:modeSelector.settings")}
									onClick={() => {
										vscode.postMessage({
											type: "switchTab",
											tab: "modes",
										})
										setOpen(false)
									}}
								/>
								{/* Import button - using Button with Download icon to match ModesView */}
								<Button
									variant="ghost"
									size="icon"
									title={t("prompts:modes.importMode")}
									onClick={() => setShowImportDialog(true)}
									disabled={isImporting}>
									<Download className="h-3.5 w-3.5" />
								</Button>
							</div>

							{/* Info icon and title on the right - only show info icon when search bar is visible */}
							<div className="flex items-center gap-1 pr-1">
								{showSearch && (
									<StandardTooltip content={instructionText}>
										<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
									</StandardTooltip>
								)}
								<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
									{t("chat:modeSelector.title")}
								</h4>
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{/* Import Mode Dialog */}
			{showImportDialog && (
				<div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[1000]">
					<div className="bg-vscode-editor-background border border-vscode-editor-lineHighlightBorder rounded-lg shadow-lg p-6 max-w-md w-full">
						<h3 className="text-lg font-semibold mb-4">{t("prompts:modes.importMode")}</h3>
						<p className="text-sm text-vscode-descriptionForeground mb-4">
							{t("prompts:importMode.selectLevel")}
						</p>
						<div className="space-y-3 mb-6">
							<label className="flex items-start gap-2 cursor-pointer" htmlFor="import-level-project">
								<input
									type="radio"
									name="importLevel"
									value="project"
									id="import-level-project"
									className="mt-1"
									checked={selectedImportLevel === "project"}
									onChange={() => setSelectedImportLevel("project")}
								/>
								<div>
									<div className="font-medium">{t("prompts:importMode.project.label")}</div>
									<div className="text-xs text-vscode-descriptionForeground">
										{t("prompts:importMode.project.description")}
									</div>
								</div>
							</label>
							<label className="flex items-start gap-2 cursor-pointer" htmlFor="import-level-global">
								<input
									type="radio"
									name="importLevel"
									value="global"
									id="import-level-global"
									className="mt-1"
									checked={selectedImportLevel === "global"}
									onChange={() => setSelectedImportLevel("global")}
								/>
								<div>
									<div className="font-medium">{t("prompts:importMode.global.label")}</div>
									<div className="text-xs text-vscode-descriptionForeground">
										{t("prompts:importMode.global.description")}
									</div>
								</div>
							</label>
						</div>
						{/* Import error message */}
						{importError && <div className="text-xs text-vscode-errorForeground mb-4">{importError}</div>}
						<div className="flex justify-end gap-2">
							<Button
								variant="secondary"
								onClick={() => {
									setShowImportDialog(false)
									setImportError(null)
									setSelectedImportLevel("project") // Reset to default
								}}>
								{t("prompts:createModeDialog.buttons.cancel")}
							</Button>
							<Button variant="default" onClick={handleImportMode} disabled={isImporting}>
								{isImporting ? t("prompts:importMode.importing") : t("prompts:importMode.import")}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

export default ModeSelector
