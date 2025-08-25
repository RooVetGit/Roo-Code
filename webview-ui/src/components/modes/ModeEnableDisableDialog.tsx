import React, { useState, useEffect } from "react"
import { Eye, EyeOff, HelpCircle } from "lucide-react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Button,
	Checkbox,
	Badge,
	Separator,
	StandardTooltip,
} from "@src/components/ui"
import { cn } from "@/lib/utils"
import type { ModeConfig } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"

const SOURCE_INFO = {
	builtin: {
		label: "Built-in Modes",
		description: "Core modes provided by Roo Code",
		icon: "🏠",
		color: "builtin",
	},
	global: {
		label: "Global Modes",
		description: "Custom modes available across all workspaces",
		icon: "🌐",
		color: "global",
	},
	project: {
		label: "Project Modes",
		description: "Custom modes specific to this workspace",
		icon: "📁",
		color: "project",
	},
} as const

export type ModeSource = "builtin" | "global" | "project"

export interface ModeWithSource extends ModeConfig {
	source: ModeSource
	disabled?: boolean
}

interface ModeEnableDisableDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	modes: ModeWithSource[]
	onSave: (updatedModes: ModeWithSource[]) => void
}

interface GroupedModes {
	builtin: ModeWithSource[]
	global: ModeWithSource[]
	project: ModeWithSource[]
}

// const SOURCE_INFO = {
// 	builtin: {
// 		label: "Built-in Modes",
// 		description: "Core modes provided by Roo Code",
// 		icon: "🏠",
// 		color: "bg-blue-100 text-blue-800 border-blue-200",
// 	},
// 	global: {
// 		label: "Global Modes",
// 		description: "Custom modes available across all workspaces",
// 		icon: "🌐",
// 		color: "bg-green-100 text-green-800 border-green-200",
// 	},
// 	project: {
// 		label: "Project Modes",
// 		description: "Modes specific to this workspace",
// 		icon: "📁",
// 		color: "bg-purple-100 text-purple-800 border-purple-200",
// 	},
// } as const

export const ModeEnableDisableDialog: React.FC<ModeEnableDisableDialogProps> = ({
	open,
	onOpenChange,
	modes,
	onSave,
}) => {
	const [localModes, setLocalModes] = useState<ModeWithSource[]>(modes)
	const [hasChanges, setHasChanges] = useState(false)
	const [confirmOpen, setConfirmOpen] = useState(false)
	const [pendingAction, setPendingAction] = useState<
		| { type: "mode"; payload: string }
		| { type: "source"; payload: { source: ModeSource; enable: boolean } }
		| { type: "all"; payload: { enable: boolean } }
		| null
	>(null)

	useAppTranslation()

	// Delete handled in the mode settings window; no delete UI in this dialog.

	// Update local state when props change
	useEffect(() => {
		setLocalModes(modes)
		setHasChanges(false)
	}, [modes])

	// Group modes by source
	const groupedModes: GroupedModes = React.useMemo(() => {
		return localModes.reduce(
			(acc, mode) => {
				acc[mode.source].push(mode)
				return acc
			},
			{ builtin: [], global: [], project: [] } as GroupedModes,
		)
	}, [localModes])

	// Calculate statistics
	const stats = React.useMemo(() => {
		const total = localModes.length
		const enabled = localModes.filter((m) => !m.disabled).length
		const disabled = total - enabled

		return { total, enabled, disabled }
	}, [localModes])

	// Toggle a single mode's disabled state
	const doToggleModeImmediate = (slug: string) => {
		setLocalModes((prev) => {
			const updated = prev.map((mode) => (mode.slug === slug ? { ...mode, disabled: !mode.disabled } : mode))
			return updated
		})
		setHasChanges(true)
	}

	const attemptToggleMode = (slug: string) => {
		const mode = localModes.find((m) => m.slug === slug)
		if (!mode) return
		// If disabling a builtin that is currently enabled, show confirmation
		if (mode.source === "builtin" && !mode.disabled) {
			setPendingAction({ type: "mode", payload: slug })
			setConfirmOpen(true)
			return
		}
		doToggleModeImmediate(slug)
	}

	// Toggle all modes in a source group (with confirmation for builtin disables)
	const doToggleSourceGroupImmediate = (source: ModeSource, enable: boolean) => {
		setLocalModes((prev) => {
			const updated = prev.map((mode) => (mode.source === source ? { ...mode, disabled: !enable } : mode))
			return updated
		})
		setHasChanges(true)
	}

	const attemptToggleSourceGroup = (source: ModeSource, enable: boolean) => {
		if (source === "builtin" && enable === false) {
			// find builtin slugs that would be disabled
			const toDisable = localModes.filter((m) => m.source === "builtin" && !m.disabled).map((m) => m.slug)
			if (toDisable.length > 0) {
				setPendingAction({ type: "source", payload: { source, enable } })
				setConfirmOpen(true)
				return
			}
		}
		doToggleSourceGroupImmediate(source, enable)
	}

	// Enable/disable all modes (with confirmation for builtin disables)
	const doToggleAllModesImmediate = (enable: boolean) => {
		setLocalModes((prev) => {
			const updated = prev.map((mode) => ({ ...mode, disabled: !enable }))
			return updated
		})
		setHasChanges(true)
	}

	const attemptToggleAllModes = (enable: boolean) => {
		if (enable === false) {
			const toDisable = localModes.filter((m) => m.source === "builtin" && !m.disabled).map((m) => m.slug)
			if (toDisable.length > 0) {
				setPendingAction({ type: "all", payload: { enable } })
				setConfirmOpen(true)
				return
			}
		}
		doToggleAllModesImmediate(enable)
	}

	// Handle save
	const handleSave = () => {
		onSave(localModes)
		setHasChanges(false)
		onOpenChange(false)
	}

	// Handle cancel
	const handleCancel = () => {
		setLocalModes(modes) // Reset to original state
		setHasChanges(false)
		onOpenChange(false)
	}

	// Mode item component
	const ModeItem: React.FC<{ mode: ModeWithSource }> = ({ mode }) => (
		<div
			className={cn(
				"mode-item flex items-center justify-between p-3 rounded-lg border transition-all",
				mode.disabled && "disabled",
			)}>
			<div className="flex items-center gap-3 flex-1 min-w-0">
				<Checkbox
					checked={!mode.disabled}
					onCheckedChange={() => attemptToggleMode(mode.slug)}
					className="flex-shrink-0"
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className={cn("mode-name text-sm", mode.disabled && "disabled")}>{mode.name}</span>
						<Badge variant="outline" className={cn("source-badge text-xs px-1.5 py-0.5", mode.source)}>
							{SOURCE_INFO[mode.source].icon} {mode.source}
						</Badge>
					</div>
					{mode.description && (
						<p className={cn("mode-description text-xs mt-1 truncate", mode.disabled && "disabled")}>
							{mode.description}
						</p>
					)}
					<div className="mode-slug text-xs mt-0.5">slug: {mode.slug}</div>
				</div>
			</div>
			<div className="status-indicator flex items-center gap-1 flex-shrink-0">
				{mode.disabled ? <EyeOff className="size-4 disabled" /> : <Eye className="size-4 enabled" />}
				{/* Show delete for global custom modes (they override built-in or are user-created) */}
				{(mode.source === "global" || mode.source === "project") && (
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								// Request the App to switch to Modes and forward the delete request
								window.postMessage(
									{ type: "openDeleteModeInSettingsRequest", slug: mode.slug, name: mode.name },
									"*",
								)
							}}
							className="text-vscode-foreground">
							<span className="codicon codicon-trash"></span>
						</Button>

						{(mode as any).overridesBuiltin && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									// Ask the extension to check for rules folder and return path via message
									window.parent.postMessage(
										{ type: "deleteCustomMode", slug: mode.slug, checkOnly: true },
										"*",
									)
								}}>
								<span className="codicon codicon-restore"></span>
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	)

	// No delete handlers here — deletion lives in the dedicated mode settings UI.

	// Source group component
	const SourceGroup: React.FC<{ source: ModeSource; modes: ModeWithSource[] }> = ({ source, modes }) => {
		const sourceInfo = SOURCE_INFO[source]
		const enabled = modes.filter((m) => !m.disabled).length
		const total = modes.length
		const allEnabled = enabled === total
		const noneEnabled = enabled === 0

		return (
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h4 className="text-sm font-semibold text-gray-900">
							{sourceInfo.icon} {sourceInfo.label}
						</h4>
						<StandardTooltip content={sourceInfo.description}>
							<HelpCircle className="size-3 text-gray-400 cursor-help" />
						</StandardTooltip>
						<Badge variant="outline" className="text-xs">
							{enabled}/{total} enabled
						</Badge>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="sm"
							onClick={() => attemptToggleSourceGroup(source, true)}
							disabled={allEnabled}
							className="text-xs h-7 px-2 text-vscode-foreground">
							Enable All
						</Button>
						{source !== "builtin" && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => attemptToggleSourceGroup(source, false)}
								disabled={noneEnabled}
								className="text-xs h-7 px-2 text-vscode-foreground">
								Disable All
							</Button>
						)}
					</div>
				</div>
				{modes.length === 0 ? (
					<div className="py-4 text-sm text-vscode-descriptionForeground">Nothing to see here.</div>
				) : (
					<div className="space-y-2">
						{modes.map((mode) => (
							<ModeItem key={mode.slug} mode={mode} />
						))}
					</div>
				)}
			</div>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Eye className="size-5" />
						Enable/Disable Modes
					</DialogTitle>
					<DialogDescription>
						Control which modes are available for use. Disabled modes will not appear in the mode selector
						and will be excluded from system prompts to reduce token usage.
					</DialogDescription>
				</DialogHeader>

				{/* Statistics and bulk actions */}
				<div className="flex items-center justify-between py-3 px-4 bg-vscode-editor-background border border-vscode-input-border rounded-lg">
					<div className="flex items-center gap-4 text-sm">
						<span className="text-vscode-foreground">
							<strong>{stats.total}</strong> total modes
						</span>
						<span className="text-vscode-descriptionForeground">
							<strong>{stats.enabled}</strong> enabled
						</span>
						<span className="text-vscode-descriptionForeground">
							<strong>{stats.disabled}</strong> disabled
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => attemptToggleAllModes(true)}
							disabled={stats.enabled === stats.total}
							className="text-xs h-7 px-2">
							Enable All
						</Button>
						{/* Per design, omit a global "Disable All" here */}
					</div>
				</div>

				{/* Scrollable content */}
				<div className="flex-1 overflow-y-auto space-y-6">
					<SourceGroup source="builtin" modes={groupedModes.builtin} />
					{groupedModes.global.length > 0 && (
						<>
							<Separator />
							<SourceGroup source="global" modes={groupedModes.global} />
						</>
					)}
					{groupedModes.project.length > 0 && (
						<>
							<Separator />
							<SourceGroup source="project" modes={groupedModes.project} />
						</>
					)}
				</div>

				{/* Confirmation dialog shown when disabling built-in modes */}
				{confirmOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
						<div className="bg-white p-6 rounded-lg max-w-lg w-full">
							<h3 className="text-lg font-semibold">Disabling built-in mode(s)</h3>
							<p className="text-sm text-gray-700 mt-2">
								Disabling a built-in mode will copy it to your custom_model.yaml so you can modify or
								delete the custom copy. You can restore the original built-in mode later by deleting the
								custom mode in Mode Settings.
							</p>
							<div className="mt-4 flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => {
										// Cancel confirmation
										setConfirmOpen(false)
										setPendingAction(null)
									}}>
									Cancel
								</Button>
								<Button
									onClick={() => {
										// Proceed with pending action
										if (pendingAction) {
											if (pendingAction.type === "mode") {
												doToggleModeImmediate(pendingAction.payload)
											} else if (pendingAction.type === "source") {
												doToggleSourceGroupImmediate(
													pendingAction.payload.source,
													pendingAction.payload.enable,
												)
											} else if (pendingAction.type === "all") {
												doToggleAllModesImmediate(pendingAction.payload.enable)
											}
										}
										setConfirmOpen(false)
										setPendingAction(null)
									}}>
									Proceed
								</Button>
							</div>
						</div>
					</div>
				)}

				<DialogFooter className="flex items-center justify-between">
					<div className="text-xs text-gray-500">{hasChanges && "You have unsaved changes"}</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={!hasChanges}>
							Save Changes
						</Button>
					</div>
				</DialogFooter>

				{/* Delete handled in settings; confirmation dialog removed from this popup */}
			</DialogContent>
		</Dialog>
	)
}
