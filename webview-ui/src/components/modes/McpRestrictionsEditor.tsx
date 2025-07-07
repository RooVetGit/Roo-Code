import React, { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, Info, Plus, X, Wrench } from "lucide-react"

import { McpRestrictions, McpToolRestriction } from "@roo-code/types"

import { Button, StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn, patternMatching } from "@/lib/utils"

export interface McpServer {
	name: string
	status: "connected" | "disconnected" | "error"
	tools: Array<{ name: string; description?: string }>
	allowedInModesByDefault?: boolean
}

interface McpRestrictionsEditorProps {
	restrictions?: McpRestrictions
	availableServers: McpServer[]
	onChange: (restrictions: McpRestrictions | undefined) => void
	disabled?: boolean
}

export function McpRestrictionsEditor({
	restrictions,
	availableServers,
	onChange,
	disabled = false,
}: McpRestrictionsEditorProps) {
	const { t } = useAppTranslation()

	// Local state for UI management
	const [isExpanded, setIsExpanded] = useState(false)

	// State for collapsible server groups (collapsed by default)
	const [groupExpansionState, setGroupExpansionState] = useState({
		enabled: false,
		disabled: false,
	})

	// Initialize local state when restrictions change
	const [localRestrictions, setLocalRestrictions] = useState<McpRestrictions | undefined>(restrictions)

	useEffect(() => {
		setLocalRestrictions(restrictions)
		// Auto-expand if there are existing restrictions
		if (restrictions && Object.keys(restrictions).length > 0) {
			setIsExpanded(true)
		}
	}, [restrictions])

	// Helper to update restrictions and notify parent
	const updateRestrictions = (newRestrictions: McpRestrictions | undefined) => {
		setLocalRestrictions(newRestrictions)
		onChange(newRestrictions)
	}

	// Helper to check if any restrictions are configured
	const hasRestrictions = localRestrictions && Object.keys(localRestrictions).length > 0

	// Helper to get current server lists
	const allowedServers = localRestrictions?.allowedServers ?? []
	const disallowedServers = localRestrictions?.disallowedServers ?? []
	const allowedTools = localRestrictions?.allowedTools ?? []
	const disallowedTools = localRestrictions?.disallowedTools ?? []

	// Helper to determine server status and reasoning
	const getServerStatus = (server: McpServer) => {
		const isExplicitlyAllowed = allowedServers.includes(server.name)
		const isExplicitlyDisallowed = disallowedServers.includes(server.name)
		const allowedInModesByDefault = server.allowedInModesByDefault !== false // Default to true if not specified

		if (isExplicitlyAllowed) {
			return {
				enabled: true,
				reason: "explicitlyAllowed" as const,
				reasonText: t("prompts:mcpRestrictions.status.explicitlyAllowed"),
			}
		}

		if (isExplicitlyDisallowed) {
			return {
				enabled: false,
				reason: "explicitlyDisallowed" as const,
				reasonText: t("prompts:mcpRestrictions.status.explicitlyDisallowed"),
			}
		}

		// If allowedServers list exists, server must be in it to be enabled
		if (allowedServers.length > 0) {
			return {
				enabled: false,
				reason: "notInAllowList" as const,
				reasonText: t("prompts:mcpRestrictions.status.notInAllowList"),
			}
		}

		// No explicit restrictions, use allowedInModesByDefault
		if (allowedInModesByDefault) {
			return {
				enabled: true,
				reason: "allowedInModesByDefault" as const,
				reasonText: t("prompts:mcpRestrictions.status.allowedInModesByDefault"),
			}
		} else {
			return {
				enabled: false,
				reason: "blockedInModesByDefault" as const,
				reasonText: t("prompts:mcpRestrictions.status.blockedInModesByDefault"),
			}
		}
	}

	// Helper to check if server has complex restrictions (more than just allow/disallow)
	const _hasComplexRestrictions = (server: McpServer) => {
		// Check if server has tool-level restrictions
		const hasToolRestrictions =
			allowedTools.some((t) => t.serverName === server.name) ||
			disallowedTools.some((t) => t.serverName === server.name)

		// Only consider it "restricted" if it has tool-level restrictions
		// Simple allow/disallow at server level doesn't count as "restricted"
		return hasToolRestrictions
	}

	// Group servers by their status
	const serverGroups = {
		enabled: availableServers.filter((server) => {
			const status = getServerStatus(server)
			return status.enabled
		}),
		disabled: availableServers.filter((server) => {
			const status = getServerStatus(server)
			return !status.enabled
		}),
	}

	// Helper to toggle group expansion
	const toggleGroupExpansion = (groupType: "enabled" | "disabled") => {
		setGroupExpansionState((prev) => ({
			...prev,
			[groupType]: !prev[groupType],
		}))
	}

	// Server management functions
	const toggleServerInList = (serverName: string, listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedServers : disallowedServers
		const otherList = listType === "allowed" ? disallowedServers : allowedServers

		let newRestrictions = { ...(localRestrictions || {}) } // Ensure we always have a valid object to spread

		if (currentList.includes(serverName)) {
			// Remove from current list
			const updatedList = currentList.filter((s) => s !== serverName)
			if (listType === "allowed") {
				newRestrictions.allowedServers = updatedList.length > 0 ? updatedList : undefined
			} else {
				newRestrictions.disallowedServers = updatedList.length > 0 ? updatedList : undefined
			}
		} else {
			// Add to current list and remove from other list if present
			const updatedCurrentList = [...currentList, serverName]
			const updatedOtherList = otherList.filter((s) => s !== serverName)

			if (listType === "allowed") {
				newRestrictions.allowedServers = updatedCurrentList
				newRestrictions.disallowedServers = updatedOtherList.length > 0 ? updatedOtherList : undefined
			} else {
				newRestrictions.disallowedServers = updatedCurrentList
				newRestrictions.allowedServers = updatedOtherList.length > 0 ? updatedOtherList : undefined
			}
		}

		// Clean up empty restrictions
		if (Object.values(newRestrictions).every((list) => !list || list.length === 0)) {
			newRestrictions = {}
		}

		updateRestrictions(Object.keys(newRestrictions).length > 0 ? newRestrictions : undefined)
	}

	// Tool management functions
	const addToolRestriction = (listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const newTool: McpToolRestriction = { serverName: "", toolName: "" }
		const updatedList = [...currentList, newTool]

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]: updatedList,
		}

		updateRestrictions(newRestrictions)
	}

	const updateToolRestriction = (
		index: number,
		listType: "allowed" | "disallowed",
		field: "serverName" | "toolName",
		value: string,
	) => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const updatedList = [...currentList]
		updatedList[index] = { ...updatedList[index], [field]: value }

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]: updatedList,
		}

		updateRestrictions(newRestrictions)
	}

	const removeToolRestriction = (index: number, listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const updatedList = currentList.filter((_, i) => i !== index)

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]:
				updatedList.length > 0 ? updatedList : undefined,
		}

		// Clean up empty restrictions
		if (Object.values(newRestrictions).every((list) => !list || list.length === 0)) {
			updateRestrictions(undefined)
		} else {
			updateRestrictions(newRestrictions)
		}
	}

	const clearAllRestrictions = () => {
		updateRestrictions(undefined)
		setIsExpanded(false)
	}

	if (availableServers.length === 0) {
		return (
			<div className="mb-4">
				<div className="font-bold mb-1">{t("prompts:mcpRestrictions.title")}</div>
				<div className="text-sm text-vscode-descriptionForeground p-3 border border-vscode-widget-border rounded">
					<Info className="inline w-4 h-4 mr-2" />
					{t("prompts:mcpRestrictions.noServersAvailable")}
				</div>
			</div>
		)
	}

	return (
		<div className="mb-4">
			<div className="flex justify-between items-center mb-1">
				<div className="font-bold">{t("prompts:mcpRestrictions.title")}</div>
				<div className="flex gap-2">
					{hasRestrictions && (
						<StandardTooltip content={t("prompts:mcpRestrictions.clearAll")}>
							<Button variant="ghost" size="icon" onClick={clearAllRestrictions} disabled={disabled}>
								<X className="w-4 h-4" />
							</Button>
						</StandardTooltip>
					)}
					<StandardTooltip
						content={
							isExpanded ? t("prompts:mcpRestrictions.collapse") : t("prompts:mcpRestrictions.expand")
						}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsExpanded(!isExpanded)}
							disabled={disabled}>
							{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
						</Button>
					</StandardTooltip>
				</div>
			</div>

			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("prompts:mcpRestrictions.description")}
			</div>

			{hasRestrictions && !isExpanded && (
				<div className="text-sm text-vscode-foreground mb-2 p-2 bg-vscode-editor-background border border-vscode-widget-border rounded">
					{t("prompts:mcpRestrictions.restrictionsConfigured", {
						count: [allowedServers, disallowedServers, allowedTools, disallowedTools].filter(
							(list) => list.length > 0,
						).length,
					})}
				</div>
			)}

			{isExpanded && (
				<div className="border border-vscode-widget-border rounded p-3 space-y-4">
					{/* Server Restrictions */}
					<div className="space-y-4">
						{/* Overview Summary */}
						<div className="text-sm text-vscode-descriptionForeground p-3 bg-vscode-editor-background border border-vscode-widget-border rounded">
							<div className="font-medium mb-2">{t("prompts:mcpRestrictions.servers.overview")}</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-green-500" />
									<span>
										{t("prompts:mcpRestrictions.servers.enabledCount", {
											count: serverGroups.enabled.length,
											names: serverGroups.enabled.map((s) => s.name).join(", ") || "None",
										})}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-red-500" />
									<span>
										{t("prompts:mcpRestrictions.servers.disabledCount", {
											count: serverGroups.disabled.length,
											names: serverGroups.disabled.map((s) => s.name).join(", ") || "None",
										})}
									</span>
								</div>
							</div>
						</div>

						{/* Collapsible Server Groups */}
						<div className="space-y-3">
							{/* Enabled Servers Group */}
							<CollapsibleServerGroup
								title={t("prompts:mcpRestrictions.serverGroups.enabled")}
								servers={serverGroups.enabled}
								isExpanded={groupExpansionState.enabled}
								onToggleExpanded={() => toggleGroupExpansion("enabled")}
								allowedServers={allowedServers}
								disallowedServers={disallowedServers}
								allowedTools={allowedTools}
								disallowedTools={disallowedTools}
								getServerStatus={getServerStatus}
								toggleServerInList={toggleServerInList}
								updateToolRestriction={updateToolRestriction}
								addToolRestriction={addToolRestriction}
								removeToolRestriction={removeToolRestriction}
								updateRestrictions={updateRestrictions}
								localRestrictions={localRestrictions}
								disabled={disabled}
								icon={<div className="w-3 h-3 rounded-full bg-green-500" />}
								groupType="enabled"
							/>

							{/* Disabled Servers Group */}
							<CollapsibleServerGroup
								title={t("prompts:mcpRestrictions.serverGroups.disabled")}
								servers={serverGroups.disabled}
								isExpanded={groupExpansionState.disabled}
								onToggleExpanded={() => toggleGroupExpansion("disabled")}
								allowedServers={allowedServers}
								disallowedServers={disallowedServers}
								allowedTools={allowedTools}
								disallowedTools={disallowedTools}
								getServerStatus={getServerStatus}
								toggleServerInList={toggleServerInList}
								updateToolRestriction={updateToolRestriction}
								addToolRestriction={addToolRestriction}
								removeToolRestriction={removeToolRestriction}
								updateRestrictions={updateRestrictions}
								localRestrictions={localRestrictions}
								disabled={disabled}
								icon={<div className="w-3 h-3 rounded-full bg-red-500" />}
								groupType="disabled"
							/>
						</div>

						{/* Legacy Server Restrictions Summary */}
						{(allowedServers.length > 0 || disallowedServers.length > 0) && (
							<div className="text-sm text-vscode-descriptionForeground p-2 bg-vscode-editor-background border border-vscode-widget-border rounded">
								{allowedServers.length > 0 && (
									<div>
										<strong>{t("prompts:mcpRestrictions.servers.allowedServers")}:</strong>{" "}
										{allowedServers.join(", ")}
									</div>
								)}
								{disallowedServers.length > 0 && (
									<div>
										<strong>{t("prompts:mcpRestrictions.servers.disallowedServers")}:</strong>{" "}
										{disallowedServers.join(", ")}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

// CollapsibleServerGroup component for organizing servers by status
interface CollapsibleServerGroupProps {
	title: string
	servers: McpServer[]
	isExpanded: boolean
	onToggleExpanded: () => void
	allowedServers: string[]
	disallowedServers: string[]
	allowedTools: McpToolRestriction[]
	disallowedTools: McpToolRestriction[]
	getServerStatus: (server: McpServer) => { enabled: boolean; reason: string; reasonText: string }
	toggleServerInList: (serverName: string, listType: "allowed" | "disallowed") => void
	updateToolRestriction: (
		index: number,
		listType: "allowed" | "disallowed",
		field: "serverName" | "toolName",
		value: string,
	) => void
	addToolRestriction: (listType: "allowed" | "disallowed") => void
	removeToolRestriction: (index: number, listType: "allowed" | "disallowed") => void
	updateRestrictions: (restrictions: McpRestrictions | undefined) => void
	localRestrictions?: McpRestrictions
	disabled?: boolean
	icon: React.ReactNode
	groupType: "enabled" | "disabled"
}

function CollapsibleServerGroup({
	title,
	servers,
	isExpanded,
	onToggleExpanded,
	allowedServers,
	disallowedServers,
	allowedTools,
	disallowedTools,
	getServerStatus,
	toggleServerInList,
	updateToolRestriction,
	addToolRestriction,
	removeToolRestriction,
	updateRestrictions,
	localRestrictions,
	disabled,
	icon,
	groupType,
}: CollapsibleServerGroupProps) {
	const { t } = useAppTranslation()

	if (servers.length === 0) return null

	return (
		<div className="border border-vscode-widget-border rounded">
			{/* Group Header */}
			<div
				className="flex items-center justify-between p-3 cursor-pointer hover:bg-vscode-list-hoverBackground"
				onClick={onToggleExpanded}>
				<div className="flex items-center gap-2">
					{icon}
					<span className="font-medium text-vscode-foreground">
						{title} ({servers.length})
					</span>
				</div>
				<div className="flex items-center gap-2">
					{/* Group Actions */}
					{servers.length > 1 && (
						<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
							{groupType !== "enabled" && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										servers.forEach((server) => {
											if (!allowedServers.includes(server.name)) {
												toggleServerInList(server.name, "allowed")
											}
										})
									}}
									disabled={disabled}
									className="text-xs h-6 py-0 px-2">
									{t("prompts:mcpRestrictions.serverGroups.allowAll")}
								</Button>
							)}
							{groupType !== "disabled" && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										servers.forEach((server) => {
											if (!disallowedServers.includes(server.name)) {
												toggleServerInList(server.name, "disallowed")
											}
										})
									}}
									disabled={disabled}
									className="text-xs h-6 py-0 px-2">
									{t("prompts:mcpRestrictions.serverGroups.blockAll")}
								</Button>
							)}
						</div>
					)}
					<ChevronDown className={cn("w-4 h-4 transition-transform", { "rotate-180": isExpanded })} />
				</div>
			</div>

			{/* Group Content */}
			{isExpanded && (
				<div className="border-t border-vscode-widget-border">
					<div className="space-y-2 p-2">
						{servers.map((server) => (
							<CompactServerRow
								key={server.name}
								server={server}
								allowedServers={allowedServers}
								disallowedServers={disallowedServers}
								allowedTools={allowedTools}
								disallowedTools={disallowedTools}
								getServerStatus={getServerStatus}
								toggleServerInList={toggleServerInList}
								updateToolRestriction={updateToolRestriction}
								addToolRestriction={addToolRestriction}
								removeToolRestriction={removeToolRestriction}
								updateRestrictions={updateRestrictions}
								localRestrictions={localRestrictions}
								disabled={disabled}
								groupType={groupType}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// Compact server row for use within collapsed groups
interface CompactServerRowProps {
	server: McpServer
	allowedServers: string[]
	disallowedServers: string[]
	allowedTools: McpToolRestriction[]
	disallowedTools: McpToolRestriction[]
	getServerStatus: (server: McpServer) => { enabled: boolean; reason: string; reasonText: string }
	toggleServerInList: (serverName: string, listType: "allowed" | "disallowed") => void
	updateToolRestriction: (
		index: number,
		listType: "allowed" | "disallowed",
		field: "serverName" | "toolName",
		value: string,
	) => void
	addToolRestriction: (listType: "allowed" | "disallowed") => void
	removeToolRestriction: (index: number, listType: "allowed" | "disallowed") => void
	updateRestrictions: (restrictions: McpRestrictions | undefined) => void
	localRestrictions?: McpRestrictions
	disabled?: boolean
	groupType: "enabled" | "disabled"
}

function CompactServerRow({
	server,
	allowedServers,
	disallowedServers,
	allowedTools,
	disallowedTools,
	getServerStatus,
	toggleServerInList,
	updateToolRestriction: _updateToolRestriction,
	addToolRestriction: _addToolRestriction,
	removeToolRestriction,
	updateRestrictions,
	localRestrictions,
	disabled,
	groupType: _groupType,
}: CompactServerRowProps) {
	const { t } = useAppTranslation()
	const [showDetails, setShowDetails] = useState(false)
	const [showTools, setShowTools] = useState(false)
	const [showPatternRules, setShowPatternRules] = useState(false)
	const isAllowed = allowedServers.includes(server.name)
	const isDisallowed = disallowedServers.includes(server.name)
	const status = getServerStatus(server)

	// Helper to check if server has complex restrictions (more than just allow/disallow)
	const hasComplexRestrictions = (server: McpServer) => {
		// Check if server has tool-level restrictions
		const hasToolRestrictions =
			allowedTools.some((t) => t.serverName === server.name) ||
			disallowedTools.some((t) => t.serverName === server.name)

		// Only consider it "restricted" if it has tool-level restrictions
		// Simple allow/disallow at server level doesn't count as "restricted"
		return hasToolRestrictions
	}

	// Handler for individual tool actions (allow/block)
	const handleToolAction = (toolName: string, action: "allow" | "block") => {
		if (action === "block") {
			// Add to disallowed tools for this server
			const currentList = disallowedTools
			const newTool: McpToolRestriction = { serverName: server.name, toolName: toolName }
			const updatedList = [...currentList, newTool]

			const newRestrictions = {
				...(localRestrictions || {}),
				disallowedTools: updatedList,
			}

			updateRestrictions(newRestrictions)
		} else {
			// Remove from disallowed tools if present
			const disallowedIndex = disallowedTools.findIndex(
				(t) => t.serverName === server.name && t.toolName === toolName,
			)
			if (disallowedIndex !== -1) {
				removeToolRestriction(disallowedIndex, "disallowed")
			}
		}
	}

	// Handler for bulk tool actions
	const handleBulkToolAction = (action: "allow" | "block") => {
		if (action === "block") {
			// Add pattern to block all tools for this server
			const currentList = disallowedTools
			const newTool: McpToolRestriction = { serverName: server.name, toolName: "*" }
			const updatedList = [...currentList, newTool]

			const newRestrictions = {
				...(localRestrictions || {}),
				disallowedTools: updatedList,
			}

			updateRestrictions(newRestrictions)
		} else {
			// Remove all disallowed tools for this server
			const updatedList = disallowedTools.filter((tool) => tool.serverName !== server.name)

			const newRestrictions = {
				...(localRestrictions || {}),
				disallowedTools: updatedList.length > 0 ? updatedList : undefined,
			}

			// Clean up empty restrictions
			if (Object.values(newRestrictions).every((list) => !list || list.length === 0)) {
				updateRestrictions(undefined)
			} else {
				updateRestrictions(newRestrictions)
			}
		}
	}

	// Handler for adding pattern rules
	const handleAddPatternRule = (type: "allow" | "block", pattern: string) => {
		if (type === "allow") {
			const currentList = allowedTools
			const newTool: McpToolRestriction = { serverName: server.name, toolName: pattern }
			const updatedList = [...currentList, newTool]

			const newRestrictions = {
				...(localRestrictions || {}),
				allowedTools: updatedList,
			}

			updateRestrictions(newRestrictions)
		} else {
			const currentList = disallowedTools
			const newTool: McpToolRestriction = { serverName: server.name, toolName: pattern }
			const updatedList = [...currentList, newTool]

			const newRestrictions = {
				...(localRestrictions || {}),
				disallowedTools: updatedList,
			}

			updateRestrictions(newRestrictions)
		}
	}

	// Handler for removing pattern rules
	const handleRemovePatternRule = (type: "allow" | "block", index: number) => {
		if (type === "allow") {
			removeToolRestriction(index, "allowed")
		} else {
			removeToolRestriction(index, "disallowed")
		}
	}

	// Helper function to calculate enabled tools for servers with restrictions
	const getEnabledToolsCount = () => {
		if (!hasComplexRestrictions(server)) {
			return server.tools.length
		}

		// For servers with restrictions, calculate how many tools are actually enabled
		const serverAllowedTools = allowedTools.filter((t) => t.serverName === server.name)
		const serverDisallowedTools = disallowedTools.filter((t) => t.serverName === server.name)

		// If there are allowed tools specified for this server, only those are enabled
		if (serverAllowedTools.length > 0) {
			return server.tools.filter((tool) => {
				return serverAllowedTools.some((allowedTool) =>
					patternMatching.matchesPattern(tool.name, allowedTool.toolName),
				)
			}).length
		}

		// If no allowed tools but there are disallowed tools, count enabled tools
		if (serverDisallowedTools.length > 0) {
			return server.tools.filter((tool) => {
				return !serverDisallowedTools.some((disallowedTool) =>
					patternMatching.matchesPattern(tool.name, disallowedTool.toolName),
				)
			}).length
		}

		// No tool restrictions for this server
		return server.tools.length
	}

	const enabledToolsCount = getEnabledToolsCount()
	const totalToolsCount = server.tools.length

	// Helper function to organize tools by enabled/disabled status
	const getOrganizedTools = () => {
		if (!status.enabled) {
			// For disabled servers, all tools are disabled
			return {
				enabled: [],
				disabled: server.tools.map((tool) => ({ ...tool, isEnabled: false })),
			}
		}

		const serverAllowedTools = allowedTools.filter((t) => t.serverName === server.name)
		const serverDisallowedTools = disallowedTools.filter((t) => t.serverName === server.name)

		const enabledTools = []
		const disabledTools = []

		for (const tool of server.tools) {
			let isEnabled = true

			// Check if there are specific allowed tools for this server
			if (serverAllowedTools.length > 0) {
				isEnabled = serverAllowedTools.some((allowedTool) =>
					patternMatching.matchesPattern(tool.name, allowedTool.toolName),
				)
			} else if (serverDisallowedTools.length > 0) {
				// Check if tool is specifically disallowed
				isEnabled = !serverDisallowedTools.some((disallowedTool) =>
					patternMatching.matchesPattern(tool.name, disallowedTool.toolName),
				)
			}

			if (isEnabled) {
				enabledTools.push({ ...tool, isEnabled: true })
			} else {
				disabledTools.push({ ...tool, isEnabled: false })
			}
		}

		return { enabled: enabledTools, disabled: disabledTools }
	}

	const organizedTools = getOrganizedTools()

	return (
		<div className="border border-vscode-panel-border rounded bg-vscode-editor-background">
			{/* Compact Row */}
			<div className="flex items-center justify-between p-2">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					{/* Status indicator */}
					<div
						className={cn("w-2 h-2 rounded-full flex-shrink-0", {
							"bg-green-500": status.enabled,
							"bg-red-500": !status.enabled,
						})}
					/>

					{/* Server info */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-medium text-vscode-foreground truncate">{server.name}</span>
							<span className="text-xs text-vscode-descriptionForeground">
								{hasComplexRestrictions(server)
									? `(${enabledToolsCount} out of ${totalToolsCount} tools)`
									: `(${totalToolsCount} tools)`}
							</span>
							<span
								className={cn("text-xs px-1.5 py-0.5 rounded", {
									"bg-green-600/20 text-green-300": status.enabled,
									"bg-red-600/20 text-red-300": !status.enabled,
								})}>
								{status.enabled
									? t("prompts:mcpRestrictions.status.enabled")
									: t("prompts:mcpRestrictions.status.disabled")}
							</span>
						</div>
					</div>

					{/* View Tools button */}
					<StandardTooltip
						content={
							showTools
								? t("prompts:mcpRestrictions.tools.hideTools")
								: t("prompts:mcpRestrictions.tools.viewTools")
						}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setShowTools(!showTools)}
							className="h-6 w-6 flex-shrink-0">
							<Wrench className="w-3 h-3" />
						</Button>
					</StandardTooltip>

					{/* Expand details button */}
					<StandardTooltip content={t("prompts:mcpRestrictions.status.reason")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setShowDetails(!showDetails)}
							className="h-6 w-6 flex-shrink-0">
							<Info className="w-3 h-3" />
						</Button>
					</StandardTooltip>
				</div>

				{/* Action buttons */}
				<div className="flex gap-1 flex-shrink-0">
					<Button
						variant={isAllowed ? "secondary" : "ghost"}
						size="sm"
						onClick={() => toggleServerInList(server.name, "allowed")}
						disabled={disabled}
						className={cn("text-xs h-6 py-0 px-2", {
							"bg-green-600/20 border-green-600/50": isAllowed,
						})}>
						{t("prompts:mcpRestrictions.servers.allow")}
					</Button>
					<Button
						variant={isDisallowed ? "secondary" : "ghost"}
						size="sm"
						onClick={() => toggleServerInList(server.name, "disallowed")}
						disabled={disabled}
						className={cn("text-xs h-6 py-0 px-2", {
							"bg-red-600/20 border-red-600/50": isDisallowed,
						})}>
						{t("prompts:mcpRestrictions.servers.disallow")}
					</Button>
				</div>
			</div>

			{/* Detailed info (expandable) */}
			{showDetails && (
				<div className="border-t border-vscode-panel-border p-2 text-xs text-vscode-descriptionForeground bg-vscode-textCodeBlock-background">
					<div>
						<strong>{t("prompts:mcpRestrictions.status.reason")}:</strong> {status.reasonText}
					</div>
					{server.allowedInModesByDefault === false && (
						<div className="mt-1 text-vscode-editorWarning-foreground">
							{t("prompts:mcpRestrictions.servers.optIn")}
						</div>
					)}
				</div>
			)}

			{/* Tools list (expandable) */}
			{showTools && (
				<div className="border-t border-vscode-panel-border bg-vscode-textCodeBlock-background">
					<div className="p-2">
						<div className="flex items-center justify-between mb-2">
							<div className="text-xs font-medium text-vscode-foreground">
								{t("prompts:mcpRestrictions.tools.serverTools", { serverName: server.name })}
							</div>
							{/* Quick Actions */}
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleBulkToolAction("allow")}
									disabled={disabled}
									className="text-xs h-6 py-0 px-2">
									{t("prompts:mcpRestrictions.tools.allowAll")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleBulkToolAction("block")}
									disabled={disabled}
									className="text-xs h-6 py-0 px-2">
									{t("prompts:mcpRestrictions.tools.blockAll")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowPatternRules(!showPatternRules)}
									disabled={disabled}
									className="text-xs h-6 py-0 px-2">
									{t("prompts:mcpRestrictions.tools.patterns")}
								</Button>
							</div>
						</div>

						{/* Pattern Rules Section */}
						{showPatternRules && (
							<div className="mb-3 p-2 bg-vscode-editor-background border border-vscode-widget-border rounded">
								<div className="text-xs font-medium text-vscode-foreground mb-2">
									{t("prompts:mcpRestrictions.tools.patternRules")}
								</div>
								<ServerPatternRules
									server={server}
									allowedTools={allowedTools}
									disallowedTools={disallowedTools}
									onAddRule={handleAddPatternRule}
									onRemoveRule={handleRemovePatternRule}
									disabled={disabled}
								/>
							</div>
						)}

						<div className="max-h-48 overflow-y-auto space-y-1">
							{/* Enabled tools first */}
							{organizedTools.enabled.map((tool) => (
								<div
									key={`enabled-${tool.name}`}
									className="flex items-center gap-2 p-1.5 rounded bg-vscode-editor-background">
									<div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<div className="text-xs font-medium text-vscode-foreground truncate">
											{tool.name}
										</div>
										{tool.description && (
											<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">
												{tool.description}
											</div>
										)}
									</div>
									<div className="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleToolAction(tool.name, "block")}
											disabled={disabled}
											className="text-xs h-5 py-0 px-1">
											{t("prompts:mcpRestrictions.tools.block")}
										</Button>
									</div>
								</div>
							))}

							{/* Disabled tools after */}
							{organizedTools.disabled.map((tool) => (
								<div
									key={`disabled-${tool.name}`}
									className="flex items-center gap-2 p-1.5 rounded bg-vscode-editor-background opacity-50">
									<div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<div className="text-xs font-medium text-vscode-descriptionForeground truncate">
											{tool.name}
										</div>
										{tool.description && (
											<div className="text-xs text-vscode-descriptionForeground truncate mt-0.5">
												{tool.description}
											</div>
										)}
									</div>
									<div className="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleToolAction(tool.name, "allow")}
											disabled={disabled}
											className="text-xs h-5 py-0 px-1">
											{t("prompts:mcpRestrictions.tools.allow")}
										</Button>
									</div>
								</div>
							))}

							{/* Show message if no tools */}
							{organizedTools.enabled.length === 0 && organizedTools.disabled.length === 0 && (
								<div className="text-xs text-vscode-descriptionForeground text-center py-4">
									{t("prompts:mcpRestrictions.tools.noTools")}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

// ServerPatternRules component for managing pattern-based rules per server
interface ServerPatternRulesProps {
	server: McpServer
	allowedTools: McpToolRestriction[]
	disallowedTools: McpToolRestriction[]
	onAddRule: (type: "allow" | "block", pattern: string) => void
	onRemoveRule: (type: "allow" | "block", index: number) => void
	disabled?: boolean
}

function ServerPatternRules({
	server,
	allowedTools,
	disallowedTools,
	onAddRule,
	onRemoveRule,
	disabled,
}: ServerPatternRulesProps) {
	const { t } = useAppTranslation()
	const [newAllowPattern, setNewAllowPattern] = useState("")
	const [newBlockPattern, setNewBlockPattern] = useState("")

	// Get pattern rules specific to this server
	const serverAllowedPatterns = allowedTools
		.map((tool, index) => ({ ...tool, originalIndex: index }))
		.filter((tool) => tool.serverName === server.name)

	const serverDisallowedPatterns = disallowedTools
		.map((tool, index) => ({ ...tool, originalIndex: index }))
		.filter((tool) => tool.serverName === server.name)

	const handleAddAllowPattern = () => {
		if (newAllowPattern.trim()) {
			onAddRule("allow", newAllowPattern.trim())
			setNewAllowPattern("")
		}
	}

	const handleAddBlockPattern = () => {
		if (newBlockPattern.trim()) {
			onAddRule("block", newBlockPattern.trim())
			setNewBlockPattern("")
		}
	}

	return (
		<div className="space-y-3">
			{/* Allow Patterns */}
			<div>
				<div className="text-xs font-medium text-vscode-foreground mb-1">
					{t("prompts:mcpRestrictions.tools.allowPatterns")}
				</div>
				<div className="space-y-1">
					{serverAllowedPatterns.map((pattern) => (
						<div
							key={`allow-${pattern.originalIndex}`}
							className="flex items-center gap-2 p-1.5 bg-green-600/10 border border-green-600/30 rounded">
							<code className="text-xs text-green-300 flex-1">{pattern.toolName}</code>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onRemoveRule("allow", pattern.originalIndex)}
								disabled={disabled}
								className="h-4 w-4 p-0">
								<X className="w-3 h-3" />
							</Button>
						</div>
					))}
					<div className="flex gap-1">
						<input
							type="text"
							value={newAllowPattern}
							onChange={(e) => setNewAllowPattern(e.target.value)}
							onKeyPress={(e) => e.key === "Enter" && handleAddAllowPattern()}
							placeholder={t("prompts:mcpRestrictions.tools.patternPlaceholder")}
							disabled={disabled}
							className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
						/>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleAddAllowPattern}
							disabled={disabled || !newAllowPattern.trim()}
							className="text-xs h-6 py-0 px-2">
							<Plus className="w-3 h-3" />
						</Button>
					</div>
				</div>
			</div>

			{/* Block Patterns */}
			<div>
				<div className="text-xs font-medium text-vscode-foreground mb-1">
					{t("prompts:mcpRestrictions.tools.blockPatterns")}
				</div>
				<div className="space-y-1">
					{serverDisallowedPatterns.map((pattern) => (
						<div
							key={`block-${pattern.originalIndex}`}
							className="flex items-center gap-2 p-1.5 bg-red-600/10 border border-red-600/30 rounded">
							<code className="text-xs text-red-300 flex-1">{pattern.toolName}</code>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onRemoveRule("block", pattern.originalIndex)}
								disabled={disabled}
								className="h-4 w-4 p-0">
								<X className="w-3 h-3" />
							</Button>
						</div>
					))}
					<div className="flex gap-1">
						<input
							type="text"
							value={newBlockPattern}
							onChange={(e) => setNewBlockPattern(e.target.value)}
							onKeyPress={(e) => e.key === "Enter" && handleAddBlockPattern()}
							placeholder={t("prompts:mcpRestrictions.tools.patternPlaceholder")}
							disabled={disabled}
							className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
						/>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleAddBlockPattern}
							disabled={disabled || !newBlockPattern.trim()}
							className="text-xs h-6 py-0 px-2">
							<Plus className="w-3 h-3" />
						</Button>
					</div>
				</div>
			</div>

			{/* Pattern Help */}
			<div className="text-xs text-vscode-descriptionForeground p-2 bg-vscode-textCodeBlock-background rounded">
				<div className="font-medium mb-1">{t("prompts:mcpRestrictions.patterns.help")}</div>
				<div className="space-y-0.5">
					<div>
						<code>*</code> - {t("prompts:mcpRestrictions.patterns.wildcard")}
					</div>
					<div>
						<code>get_*</code> - {t("prompts:mcpRestrictions.patterns.example1")}
					</div>
					<div>
						<code>*_admin</code> - {t("prompts:mcpRestrictions.patterns.example2")}
					</div>
				</div>
			</div>
		</div>
	)
}
