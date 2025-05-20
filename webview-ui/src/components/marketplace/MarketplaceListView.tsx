import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Clock, X, ChevronsUpDown, Rocket, Server, Package, Sparkles, ALargeSmall } from "lucide-react"
import { MarketplaceItemCard } from "./components/MarketplaceItemCard"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useStateManager } from "./useStateManager"

export interface MarketplaceListViewProps {
	stateManager: MarketplaceViewStateManager
	allTags: string[]
	filteredTags: string[]
	tagSearch: string
	setTagSearch: (value: string) => void
	isTagPopoverOpen: boolean
	setIsTagPopoverOpen: (value: boolean) => void
}

export function MarketplaceListView({
	stateManager,
	allTags,
	filteredTags,
	tagSearch,
	setTagSearch,
	isTagPopoverOpen,
	setIsTagPopoverOpen,
}: MarketplaceListViewProps) {
	const [state, manager] = useStateManager(stateManager)
	const { t } = useAppTranslation()
	const items = state.displayItems || []
	const isEmpty = items.length === 0

	return (
		<>
			<div>
				<div className="relative">
					<Input
						type="text"
						placeholder={t("marketplace:filters.search.placeholder")}
						value={state.filters.search}
						onChange={(e) =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { search: e.target.value } },
							})
						}
					/>
				</div>
				<div className="mt-2">
					<div className="flex w-full gap-1 bg-vscode-panel-background rounded-md">
						<div className="flex-1 flex flex-col">
							<label htmlFor="type-filter" className="mb-1 font-medium text-sm">
								{t("marketplace:filters.type.label")}
							</label>
							<Select
								value={state.filters.type || "all"}
								onValueChange={(value) =>
									manager.transition({
										type: "UPDATE_FILTERS",
										payload: { filters: { type: value === "all" ? "" : value } },
									})
								}>
								<SelectTrigger id="type-filter" className="w-full">
									<SelectValue placeholder={t("marketplace:filters.type.all")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">
										<span className="flex items-center gap-2">
											<ALargeSmall className="h-4 w-4" />
											{t("marketplace:filters.type.all")}
										</span>
									</SelectItem>
									<SelectItem value="mode">
										<span className="flex items-center gap-2">
											<Rocket className="h-4 w-4" />
											{t("marketplace:filters.type.mode")}
										</span>
									</SelectItem>
									<SelectItem value="mcp server">
										<span className="flex items-center gap-2">
											<Server className="h-4 w-4" />
											{t("marketplace:filters.type.mcp server")}
										</span>
									</SelectItem>
									<SelectItem value="prompt">
										<span className="flex items-center gap-2">
											<Sparkles className="h-4 w-4" />
											{t("marketplace:filters.type.prompt")}
										</span>
									</SelectItem>
									<SelectItem value="package">
										<span className="flex items-center gap-2">
											<Package className="h-4 w-4" />
											{t("marketplace:filters.type.package")}
										</span>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex-1 flex flex-col">
							<label className="mb-1 font-medium text-sm">{t("marketplace:filters.sort.label")}</label>
							<div className="flex gap-1">
								<Select
									value={state.sortConfig.by}
									onValueChange={(value) =>
										manager.transition({
											type: "UPDATE_SORT",
											payload: { sortConfig: { by: value as any } },
										})
									}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("marketplace:filters.sort.name")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="name">
											<span className="flex items-center gap-2">
												<ALargeSmall className="h-4 w-4" />
												{t("marketplace:filters.sort.name")}
											</span>
										</SelectItem>
										<SelectItem value="lastUpdated">
											<span className="flex items-center gap-2">
												<Clock className="h-4 w-4" />
												{t("marketplace:filters.sort.lastUpdated")}
											</span>
										</SelectItem>
									</SelectContent>
								</Select>
								<Button
									variant="outline"
									size="icon"
									onClick={() =>
										manager.transition({
											type: "UPDATE_SORT",
											payload: {
												sortConfig: {
													order: state.sortConfig.order === "asc" ? "desc" : "asc",
												},
											},
										})
									}
									className="shadow-none bg-vscode-input-background px-2">
									{state.sortConfig.order === "asc" ? "↑" : "↓"}
								</Button>
							</div>
						</div>
					</div>

					{allTags.length > 0 && (
						<div className="mt-2">
							<div className="flex items-center justify-between mb-1">
								<div className="flex items-center gap-1">
									<label className="font-medium text-sm">{t("marketplace:filters.tags.label")}</label>
									<span className="text-xs text-vscode-foreground">({allTags.length})</span>
								</div>
								{state.filters.tags.length > 0 && (
									<Button
										className="shadow-none font-normal flex items-center gap-1 h-auto py-0.5 px-1.5 text-xs"
										size="sm"
										variant="secondary"
										onClick={(e) => {
											e.stopPropagation() // Prevent popover from closing if it's open
											manager.transition({
												type: "UPDATE_FILTERS",
												payload: { filters: { tags: [] } },
											})
										}}>
										<span className="codicon codicon-close"></span>
										{t("marketplace:filters.tags.clear", {
											count: state.filters.tags.length,
										})}
									</Button>
								)}
							</div>

							<Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="combobox"
										role="combobox"
										aria-expanded={isTagPopoverOpen}
										className="w-full justify-between h-7">
										<span className="truncate">
											{state.filters.tags.length > 0
												? state.filters.tags
														.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
														.join(", ")
												: "None"}
										</span>
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
									<Command>
										<div className="relative">
											<CommandInput
												className="h-9 pr-8"
												placeholder={t("marketplace:filters.tags.placeholder")}
												value={tagSearch}
												onValueChange={setTagSearch}
											/>
											{tagSearch && (
												<Button
													variant="ghost"
													size="icon"
													className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
													onClick={() => setTagSearch("")}>
													<X className="h-4 w-4" />
												</Button>
											)}
										</div>
										<CommandList className="max-h-[200px] overflow-y-auto bg-vscode-dropdown-background divide-y divide-vscode-panel-border">
											<CommandEmpty className="p-2 text-sm text-vscode-descriptionForeground">
												{t("marketplace:filters.tags.noResults")}
											</CommandEmpty>
											<CommandGroup>
												{filteredTags.map((tag: string) => (
													<CommandItem
														key={tag}
														value={tag}
														onSelect={() => {
															const isSelected = state.filters.tags.includes(tag)
															manager.transition({
																type: "UPDATE_FILTERS",
																payload: {
																	filters: {
																		tags: isSelected
																			? state.filters.tags.filter(
																					(t) => t !== tag,
																				)
																			: [...state.filters.tags, tag],
																	},
																},
															})
														}}
														data-selected={state.filters.tags.includes(tag)}
														className="grid grid-cols-[1rem_1fr] gap-2 cursor-pointer text-sm capitalize"
														onMouseDown={(e) => e.preventDefault()}>
														{state.filters.tags.includes(tag) ? (
															<span className="codicon codicon-check" />
														) : (
															<span />
														)}
														{tag}
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							{state.filters.tags.length > 0 && (
								<div className="text-xs text-vscode-descriptionForeground mt-2 flex items-center min-h-[16px]">
									<span className="codicon codicon-tag mr-1"></span>
									{t("marketplace:filters.tags.selected", {
										count: state.filters.tags.length,
									})}
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{state.isFetching && (
				<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground animate-fade-in">
					<div className="animate-spin mb-4">
						<span className="codicon codicon-sync text-3xl"></span>
					</div>
					<p>{t("marketplace:items.refresh.refreshing")}</p>
					<p className="text-sm mt-2 animate-pulse">This may take a moment...</p>
				</div>
			)}

			{!state.isFetching && isEmpty && (
				<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground animate-fade-in">
					<span className="codicon codicon-inbox text-4xl mb-4 opacity-70"></span>
					<p className="font-medium">{t("marketplace:items.empty.noItems")}</p>
					<p className="text-sm mt-2">Try adjusting your filters or search terms</p>
					<Button
						onClick={() =>
							manager.transition({
								type: "UPDATE_FILTERS",
								payload: { filters: { search: "", type: "", tags: [] } },
							})
						}
						className="mt-4 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground transition-colors">
						<span className="codicon codicon-clear-all mr-2"></span>
						Clear all filters
					</Button>
				</div>
			)}

			{!state.isFetching && !isEmpty && (
				<div>
					<p className="text-vscode-descriptionForeground my-2 flex items-center">
						<span className="codicon codicon-list-filter mr-2"></span>
						{t("marketplace:items.count", { count: items.length })}
					</p>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 pb-3">
						{items.map((item) => (
							<MarketplaceItemCard
								key={`${item.repoUrl}-${item.id}`}
								item={item}
								filters={state.filters}
								installed={{
									project: state.installedMetadata.project[item.id],
									global: state.installedMetadata.global[item.id],
								}}
								setFilters={(filters) =>
									manager.transition({
										type: "UPDATE_FILTERS",
										payload: { filters },
									})
								}
								activeTab={state.activeTab}
								setActiveTab={(tab) =>
									manager.transition({
										type: "SET_ACTIVE_TAB",
										payload: { tab },
									})
								}
							/>
						))}
					</div>
				</div>
			)}
		</>
	)
}
