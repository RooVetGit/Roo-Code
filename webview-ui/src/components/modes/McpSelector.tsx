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
import { ModeConfig, GroupEntry, GroupOptions } from "@roo-code/types"
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

		const mcpGroupArr = currentMode.groups?.find(
			(g: GroupEntry): g is ["mcp", GroupOptions] => Array.isArray(g) && g.length === 2 && g[0] === "mcp",
		)

		const rawGroupOptions: GroupOptions | undefined = mcpGroupArr ? mcpGroupArr[1] : undefined

		const included = Array.isArray(rawGroupOptions?.mcp?.included)
			? (rawGroupOptions.mcp.included.filter((item) => typeof item === "string") as string[])
			: []

		// Sync MCP settings when mode changes
		setMcpIncludedList(included)
	}, [currentMode])
	// Handle save
	function updateMcpGroupOptions(groups: GroupEntry[] = [], group: string, mcpIncludedList: string[]): GroupEntry[] {
		let mcpGroupFound = false
		const newGroups = groups
			.map((g) => {
				if (Array.isArray(g) && g[0] === group) {
					mcpGroupFound = true
					return [
						group,
						{
							...(g[1] || {}),
							mcp: mcpIncludedList.length > 0 ? { included: mcpIncludedList } : undefined,
						},
					] as GroupEntry
				}
				if (typeof g === "string" && g === group) {
					mcpGroupFound = true
					return [
						group,
						{
							mcp: mcpIncludedList.length > 0 ? { included: mcpIncludedList } : undefined,
						},
					] as GroupEntry
				}
				return g
			})
			.filter((g) => g !== undefined)

		if (!mcpGroupFound && group === "mcp") {
			const groupsWithoutSimpleMcp = newGroups.filter((g) => g !== "mcp")
			groupsWithoutSimpleMcp.push([
				"mcp",
				{
					mcp: mcpIncludedList.length > 0 ? { included: mcpIncludedList } : undefined,
				},
			])
			return groupsWithoutSimpleMcp as GroupEntry[]
		} else {
			return newGroups as GroupEntry[]
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
