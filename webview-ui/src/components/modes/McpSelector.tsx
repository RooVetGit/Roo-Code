import React, { useState, useRef, useEffect } from "react"
import { ChevronsUpDown, X } from "lucide-react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	Button,
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
} from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ModeConfig, GroupEntry } from "@roo-code/types"
import { McpServer } from "@roo/mcp"

interface McpSelectorProps {
	group: string
	isEnabled: boolean
	isCustomMode: boolean
	mcpServers: McpServer[]
	currentMode?: ModeConfig
	visualMode: string
	customModes: ModeConfig[]
	findModeBySlug: (slug: string, modes: ModeConfig[]) => ModeConfig | undefined
	updateCustomMode: (slug: string, config: ModeConfig) => void
}

const McpSelector: React.FC<McpSelectorProps> = ({
	group,
	isEnabled,
	isCustomMode,
	mcpServers,
	currentMode,
	visualMode,
	customModes,
	findModeBySlug,
	updateCustomMode,
}) => {
	const { t } = useAppTranslation()

	// State
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [mcpIncludedList, setMcpIncludedList] = useState<string[]>([])
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement | null>(null)

	// Sync MCP settings
	useEffect(() => {
		if (!currentMode) {
			setMcpIncludedList([])
			return
		}

		// Find MCP group - object format: { mcp: { included: [...] } }
		const mcpGroup = currentMode.groups?.find((g: GroupEntry) => {
			return typeof g === "object" && !Array.isArray(g) && "mcp" in g
		})

		let included: string[] = []

		if (mcpGroup && typeof mcpGroup === "object" && !Array.isArray(mcpGroup) && "mcp" in mcpGroup) {
			const mcpOptions = mcpGroup as { mcp?: { included?: unknown[] } }
			included = Array.isArray(mcpOptions.mcp?.included)
				? (mcpOptions.mcp.included.filter((item) => typeof item === "string") as string[])
				: []
		}

		// Sync MCP settings when mode changes
		setMcpIncludedList(included)
	}, [currentMode])
	// Handle save
	function updateMcpGroupOptions(groups: GroupEntry[] = [], _group: string, mcpIncludedList: string[]): GroupEntry[] {
		// Filter out any existing "mcp" entries (string or object forms)
		const filteredGroups = groups.filter((g) => {
			if (typeof g === "string") {
				return g !== "mcp"
			}
			if (typeof g === "object" && g !== null && !Array.isArray(g) && "mcp" in g) {
				return false
			}
			return true
		})

		// Always add MCP back if it's enabled
		// If mcpIncludedList is empty, it means all servers are enabled (default behavior)
		// If mcpIncludedList has items, only those servers are enabled
		if (mcpIncludedList.length > 0) {
			// Specific servers selected
			return [...filteredGroups, { mcp: { included: mcpIncludedList } }] as GroupEntry[]
		} else {
			// No specific servers selected - enable all (just add "mcp" string)
			return [...filteredGroups, "mcp"] as GroupEntry[]
		}
	}

	// Handle save
	const handleSave = () => {
		const customMode = findModeBySlug(visualMode, customModes)
		if (!customMode) {
			setIsDialogOpen(false)
			return
		}

		const updatedGroups = updateMcpGroupOptions(customMode.groups, group, mcpIncludedList)

		updateCustomMode(customMode.slug, {
			...customMode,
			groups: updatedGroups,
			source: customMode.source || "global",
		})

		setIsDialogOpen(false)
	}
	if (!isCustomMode || !isEnabled) {
		return null
	}

	return (
		<Popover
			open={isDialogOpen}
			onOpenChange={(open) => {
				setIsDialogOpen(open)
				// Reset search box
				if (!open) {
					setTimeout(() => {
						setSearchValue("")
					}, 100)
				}
			}}>
			<PopoverTrigger asChild>
				<Button variant="secondary" size="sm" style={{ marginLeft: 4 }} className="flex items-center gap-1">
					{/* Dynamically display button text */}
					{mcpIncludedList.length === 0
						? t("prompts:tools.mcpAll")
						: t("prompts:tools.mcpSelectedCount", {
								included: mcpIncludedList.length,
							})}
					<ChevronsUpDown className="opacity-50 size-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-[400px] bg-vscode-editor-background">
				<Command>
					<div className="flex items-center border-b border-vscode-input-border p-2">
						<div className="font-medium text-sm flex-1">{t("prompts:tools.selectMcpServers")}</div>
						<div className="flex gap-2">
							<Button variant="secondary" size="sm" onClick={() => setMcpIncludedList([])}>
								{t("prompts:tools.buttons.clearAll")}
							</Button>
							<Button variant="default" size="sm" onClick={handleSave}>
								{t("prompts:tools.buttons.save")}
							</Button>
						</div>
					</div>
					<div className="relative">
						<CommandInput
							ref={searchInputRef}
							value={searchValue}
							onValueChange={setSearchValue}
							placeholder={t("prompts:tools.searchMcpServers")}
							className="h-9 mr-4"
						/>
						{searchValue.length > 0 && (
							<div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
								<X
									className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
									onClick={() => {
										setSearchValue("")
										searchInputRef.current?.focus()
									}}
								/>
							</div>
						)}
					</div>
					<div className="border-b border-vscode-input-border p-2">
						<div className="text-sm font-medium text-vscode-foreground mb-2">
							{t("prompts:tools.requiredMcpList")}
						</div>
						<div className="text-sm text-vscode-descriptionForeground mb-2">
							{t("prompts:tools.mcpDefaultDescription")}
						</div>
						<CommandList className="max-h-[150px] overflow-auto bg-vscode-editorWidget-background">
							<CommandEmpty>
								{mcpServers.length === 0 ? (
									<div className="py-2 px-2 text-sm text-vscode-descriptionForeground">
										{t("prompts:tools.noMcpServers")}
									</div>
								) : (
									<div className="py-2 px-2 text-sm">{t("prompts:tools.noMatchFound")}</div>
								)}
							</CommandEmpty>
							<CommandGroup>
								{(() => {
									const uniqueMcpServers = Array.from(
										new Map(mcpServers.map((server) => [server.name, server])).values(),
									)
									return uniqueMcpServers
										.filter(
											(server) =>
												!searchValue ||
												server.name.toLowerCase().includes(searchValue.toLowerCase()),
										)
										.map((server) => (
											<CommandItem
												key={`included-${server.name}`}
												value={`included-${server.name}`}
												onSelect={() => {
													const isIncluded = mcpIncludedList.includes(server.name)
													if (isIncluded) {
														setMcpIncludedList(
															mcpIncludedList.filter((n) => n !== server.name),
														)
													} else {
														setMcpIncludedList([...mcpIncludedList, server.name])
													}
												}}
												className="flex items-center px-2 py-1">
												<div className="flex items-center flex-1 gap-2">
													<VSCodeCheckbox
														checked={mcpIncludedList.includes(server.name)}
														onClick={(e) => {
															e.stopPropagation()
															const isIncluded = mcpIncludedList.includes(server.name)
															if (isIncluded) {
																setMcpIncludedList(
																	mcpIncludedList.filter((n) => n !== server.name),
																)
															} else {
																setMcpIncludedList([...mcpIncludedList, server.name])
															}
														}}
													/>
													<span>{server.name}</span>
												</div>
											</CommandItem>
										))
								})()}
							</CommandGroup>
						</CommandList>
					</div>
				</Command>
			</PopoverContent>
		</Popover>
	)
}

export default McpSelector
