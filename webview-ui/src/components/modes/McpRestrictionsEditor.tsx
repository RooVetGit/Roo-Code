import React, { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronUp, Info, Plus, X, Server, Wrench } from "lucide-react"

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
	const [activeTab, setActiveTab] = useState<"servers" | "tools">("servers")
	const [showAdvanced, setShowAdvanced] = useState(false)

	// State for collapsible server groups (collapsed by default)
	const [groupExpansionState, setGroupExpansionState] = useState({
		enabled: false,
		disabled: false,
		restricted: false,
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
	const hasComplexRestrictions = (server: McpServer) => {
		// Check if server has tool-level restrictions
		const hasToolRestrictions =
			allowedTools.some((t) => t.serverName === server.name) ||
			disallowedTools.some((t) => t.serverName === server.name)

		// Only consider it "restricted" if it has tool-level restrictions
		// Simple allow/disallow at server level doesn't count as "restricted"
		return hasToolRestrictions
	}

	// Group servers by their status and restriction state
	const serverGroups = {
		enabled: availableServers.filter((server) => {
			const status = getServerStatus(server)
			return status.enabled && !hasComplexRestrictions(server)
		}),
		disabled: availableServers.filter((server) => {
			const status = getServerStatus(server)
			return !status.enabled
		}),
		restricted: availableServers.filter((server) => {
			const status = getServerStatus(server)
			return status.enabled && hasComplexRestrictions(server)
		}),
	}

	// Helper to toggle group expansion
	const toggleGroupExpansion = (groupType: "enabled" | "disabled" | "restricted") => {
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
					{/* Tab Navigation */}
					<div className="flex gap-1 border-b border-vscode-widget-border">
						<Button
							variant={activeTab === "servers" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("servers")}
							disabled={disabled}
							className="rounded-b-none">
							{t("prompts:mcpRestrictions.tabs.servers")}
						</Button>
						<Button
							variant={activeTab === "tools" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("tools")}
							disabled={disabled}
							className="rounded-b-none">
							{t("prompts:mcpRestrictions.tabs.tools")}
						</Button>
					</div>

					{/* Server Restrictions Tab */}
					{activeTab === "servers" && (
						<div className="space-y-4">
							<div className="text-sm text-vscode-descriptionForeground">
								{t("prompts:mcpRestrictions.servers.description")}
							</div>

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
									{serverGroups.restricted.length > 0 && (
										<div className="flex items-center gap-2">
											<div className="w-2 h-2 rounded-full bg-yellow-500" />
											<span>
												{t("prompts:mcpRestrictions.servers.enabledWithRestrictionsCount", {
													count: serverGroups.restricted.length,
													names: serverGroups.restricted.map((s) => s.name).join(", "),
												})}
											</span>
										</div>
									)}
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
									disabled={disabled}
									icon={<div className="w-3 h-3 rounded-full bg-red-500" />}
									groupType="disabled"
								/>

								{/* Restricted Servers Group */}
								<CollapsibleServerGroup
									title={t("prompts:mcpRestrictions.serverGroups.restricted")}
									servers={serverGroups.restricted}
									isExpanded={groupExpansionState.restricted}
									onToggleExpanded={() => toggleGroupExpansion("restricted")}
									allowedServers={allowedServers}
									disallowedServers={disallowedServers}
									allowedTools={allowedTools}
									disallowedTools={disallowedTools}
									getServerStatus={getServerStatus}
									toggleServerInList={toggleServerInList}
									disabled={disabled}
									icon={<div className="w-3 h-3 rounded-full bg-yellow-500" />}
									groupType="restricted"
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
					)}

					{/* Tool Restrictions Tab */}
					{activeTab === "tools" && (
						<div className="space-y-4">
							<div className="text-sm text-vscode-descriptionForeground">
								{t("prompts:mcpRestrictions.tools.description")}
							</div>

							{/* Allowed Tools */}
							<div>
								<div className="flex justify-between items-center mb-2">
									<div className="font-medium text-sm">
										{t("prompts:mcpRestrictions.tools.allowedTools")}
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => addToolRestriction("allowed")}
										disabled={disabled}>
										<Plus className="w-4 h-4 mr-1" />
										{t("prompts:mcpRestrictions.tools.addAllowed")}
									</Button>
								</div>
								{allowedTools.length === 0 ? (
									<div className="text-sm text-vscode-descriptionForeground p-2 border border-vscode-widget-border rounded">
										{t("prompts:mcpRestrictions.tools.noAllowedTools")}
									</div>
								) : (
									<div className="space-y-2">
										{allowedTools.map((tool, index) => (
											<ToolRestrictionRow
												key={index}
												tool={tool}
												availableServers={availableServers}
												onUpdate={(field, value) =>
													updateToolRestriction(index, "allowed", field, value)
												}
												onRemove={() => removeToolRestriction(index, "allowed")}
												disabled={disabled}
											/>
										))}
									</div>
								)}
							</div>

							{/* Disallowed Tools */}
							<div>
								<div className="flex justify-between items-center mb-2">
									<div className="font-medium text-sm">
										{t("prompts:mcpRestrictions.tools.disallowedTools")}
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => addToolRestriction("disallowed")}
										disabled={disabled}>
										<Plus className="w-4 h-4 mr-1" />
										{t("prompts:mcpRestrictions.tools.addDisallowed")}
									</Button>
								</div>
								{disallowedTools.length === 0 ? (
									<div className="text-sm text-vscode-descriptionForeground p-2 border border-vscode-widget-border rounded">
										{t("prompts:mcpRestrictions.tools.noDisallowedTools")}
									</div>
								) : (
									<div className="space-y-2">
										{disallowedTools.map((tool, index) => (
											<ToolRestrictionRow
												key={index}
												tool={tool}
												availableServers={availableServers}
												onUpdate={(field, value) =>
													updateToolRestriction(index, "disallowed", field, value)
												}
												onRemove={() => removeToolRestriction(index, "disallowed")}
												disabled={disabled}
											/>
										))}
									</div>
								)}
							</div>

							{/* Advanced Patterns */}
							<div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowAdvanced(!showAdvanced)}
									disabled={disabled}
									className="w-full justify-start">
									{showAdvanced ? (
										<ChevronUp className="w-4 h-4 mr-1" />
									) : (
										<ChevronDown className="w-4 h-4 mr-1" />
									)}
									{t("prompts:mcpRestrictions.tools.advancedPatterns")}
								</Button>
								{showAdvanced && (
									<div className="mt-2 p-3 bg-vscode-editor-background border border-vscode-widget-border rounded text-sm">
										<div className="font-medium mb-2">
											{t("prompts:mcpRestrictions.patterns.title")}
										</div>
										<div className="space-y-1 text-vscode-descriptionForeground">
											<div>
												<code>*</code> - {t("prompts:mcpRestrictions.patterns.wildcard")}
											</div>
											<div>
												<code>?</code> - {t("prompts:mcpRestrictions.patterns.singleChar")}
											</div>
											<div className="mt-2">
												<strong>{t("prompts:mcpRestrictions.patterns.examples")}:</strong>
											</div>
											<div>
												<code>docs-*</code> - {t("prompts:mcpRestrictions.patterns.example1")}
											</div>
											<div>
												<code>*-admin</code> - {t("prompts:mcpRestrictions.patterns.example2")}
											</div>
											<div>
												<code>delete_*</code> - {t("prompts:mcpRestrictions.patterns.example3")}
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					)}
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
	disabled?: boolean
	icon: React.ReactNode
	groupType: "enabled" | "disabled" | "restricted"
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
	disabled?: boolean
	groupType: "enabled" | "disabled" | "restricted"
}

function CompactServerRow({
	server,
	allowedServers,
	disallowedServers,
	allowedTools,
	disallowedTools,
	getServerStatus,
	toggleServerInList,
	disabled,
	groupType,
}: CompactServerRowProps) {
	const { t } = useAppTranslation()
	const [showDetails, setShowDetails] = useState(false)
	const [showTools, setShowTools] = useState(false)
	const isAllowed = allowedServers.includes(server.name)
	const isDisallowed = disallowedServers.includes(server.name)
	const status = getServerStatus(server)

	// Helper function to calculate enabled tools for restricted servers
	const getEnabledToolsCount = () => {
		if (groupType !== "restricted") {
			return server.tools.length
		}

		// For restricted servers, calculate how many tools are actually enabled
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
		if (groupType === "disabled") {
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
								{groupType === "restricted"
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
						<div className="text-xs font-medium text-vscode-foreground mb-2">
							{t("prompts:mcpRestrictions.tools.serverTools", { serverName: server.name })}
						</div>
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
									<div className="text-xs text-green-300 bg-green-600/20 px-1.5 py-0.5 rounded flex-shrink-0">
										{t("prompts:mcpRestrictions.status.enabled")}
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
									<div className="text-xs text-red-300 bg-red-600/20 px-1.5 py-0.5 rounded flex-shrink-0">
										{t("prompts:mcpRestrictions.status.disabled")}
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

// ServerToolPicker component for enhanced server/tool selection
interface ServerToolPickerProps {
	value: string
	onSelect: (value: string) => void
	placeholder: string
	type: "server" | "tool"
	availableServers: McpServer[]
	selectedServerName?: string
	disabled?: boolean
}

function ServerToolPicker({
	value,
	onSelect,
	placeholder,
	type,
	availableServers,
	selectedServerName,
	disabled,
}: ServerToolPickerProps) {
	const { t } = useAppTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const dropdownRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Get available options based on type
	const getOptions = () => {
		if (type === "server") {
			return availableServers.map((server) => ({
				value: server.name,
				label: server.name,
				description: `${server.tools.length} tools available`,
				status: server.status,
				icon: <Server className="w-4 h-4" />,
			}))
		} else {
			// Tool type - find tools for the selected server
			const server = availableServers.find((s) => s.name === selectedServerName)
			if (!server) return []

			return server.tools.map((tool) => ({
				value: tool.name,
				label: tool.name,
				description: tool.description || "No description available",
				status: "available" as const,
				icon: <Wrench className="w-4 h-4" />,
			}))
		}
	}

	// Filter options based on search term with pattern support
	const filteredOptions = getOptions().filter((option) => {
		const searchValue = value || searchTerm // Use current input value or search term
		return (
			patternMatching.matchesPattern(option.label, searchValue) ||
			patternMatching.matchesPattern(option.description, searchValue)
		)
	})

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Handle option selection
	const handleSelect = (optionValue: string) => {
		onSelect(optionValue)
		setIsOpen(false)
		setSearchTerm("")
	}

	// Handle input change - allow manual typing and searching
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value
		onSelect(inputValue)
		setSearchTerm(inputValue)
		setIsOpen(true)
	}

	// Show placeholder when no value is selected
	const displayValue = value || ""

	return (
		<div className="relative" ref={dropdownRef}>
			<div className="relative">
				<input
					ref={inputRef}
					type="text"
					value={displayValue}
					onChange={handleInputChange}
					onFocus={() => setIsOpen(true)}
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						"w-full px-3 py-2 text-sm bg-vscode-input-background border border-vscode-input-border rounded",
						"focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						"pr-8", // Make room for the dropdown arrow
					)}
				/>
				<Button
					variant="ghost"
					size="icon"
					className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
					onClick={() => setIsOpen(!isOpen)}
					disabled={disabled}>
					<ChevronDown className={cn("w-3 h-3 transition-transform", { "rotate-180": isOpen })} />
				</Button>
			</div>

			{/* Dropdown */}
			{isOpen && !disabled && (
				<div
					className={cn(
						"absolute z-50 w-full mt-1 bg-vscode-dropdown-background",
						"border border-vscode-dropdown-border rounded shadow-lg",
						"max-h-64 overflow-y-auto",
					)}>
					{filteredOptions.length === 0 ? (
						<div className="px-3 py-2 text-sm text-vscode-descriptionForeground">
							{type === "server"
								? t("prompts:mcpRestrictions.picker.noServers")
								: selectedServerName
									? t("prompts:mcpRestrictions.picker.noTools")
									: t("prompts:mcpRestrictions.picker.selectServerFirst")}
						</div>
					) : (
						filteredOptions.map((option, _index) => (
							<div
								key={option.value}
								className={cn(
									"flex items-center gap-3 px-3 py-2 cursor-pointer",
									"hover:bg-vscode-list-hoverBackground",
									"border-b border-vscode-dropdown-border last:border-b-0",
									{ "bg-vscode-list-activeSelectionBackground": value === option.value },
								)}
								onClick={() => handleSelect(option.value)}>
								{/* Icon */}
								<div className="flex-shrink-0 text-vscode-descriptionForeground">{option.icon}</div>

								{/* Content */}
								<div className="flex-grow min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-vscode-foreground truncate">
											{option.label}
										</span>
										{type === "server" && option.status && (
											<div
												className={cn("w-2 h-2 rounded-full flex-shrink-0", {
													"bg-green-500": option.status === "connected",
													"bg-red-500": option.status === "error",
													"bg-yellow-500": option.status === "disconnected",
												})}
											/>
										)}
									</div>
									<div className="text-xs text-vscode-descriptionForeground truncate">
										{option.description}
									</div>
								</div>

								{/* Selection indicator */}
								{value === option.value && (
									<div className="flex-shrink-0 text-vscode-foreground">
										<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
								)}
							</div>
						))
					)}
				</div>
			)}
		</div>
	)
}

// Helper component for tool restriction rows
interface ToolRestrictionRowProps {
	tool: McpToolRestriction
	availableServers: McpServer[]
	onUpdate: (field: "serverName" | "toolName", value: string) => void
	onRemove: () => void
	disabled?: boolean
}

function ToolRestrictionRow({ tool, availableServers, onUpdate, onRemove, disabled }: ToolRestrictionRowProps) {
	const { t } = useAppTranslation()

	return (
		<div className="flex items-center gap-2 p-3 border border-vscode-widget-border rounded bg-vscode-editor-background">
			{/* Server Name Picker */}
			<div className="flex-1">
				<div className="text-xs text-vscode-descriptionForeground mb-1">
					{t("prompts:mcpRestrictions.tools.serverName")}
				</div>
				<ServerToolPicker
					value={tool.serverName}
					onSelect={(value) => onUpdate("serverName", value)}
					placeholder={t("prompts:mcpRestrictions.tools.serverNamePlaceholder")}
					type="server"
					availableServers={availableServers}
					disabled={disabled}
				/>
			</div>

			{/* Tool Name Picker */}
			<div className="flex-1">
				<div className="text-xs text-vscode-descriptionForeground mb-1">
					{t("prompts:mcpRestrictions.tools.toolName")}
				</div>
				<ServerToolPicker
					value={tool.toolName}
					onSelect={(value) => onUpdate("toolName", value)}
					placeholder={t("prompts:mcpRestrictions.tools.toolNamePlaceholder")}
					type="tool"
					availableServers={availableServers}
					selectedServerName={tool.serverName}
					disabled={disabled}
				/>
			</div>

			{/* Remove Button */}
			<div className="flex-shrink-0 pt-4">
				<StandardTooltip content={t("prompts:mcpRestrictions.tools.remove")}>
					<Button variant="ghost" size="icon" onClick={onRemove} disabled={disabled}>
						<X className="w-4 h-4" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}
