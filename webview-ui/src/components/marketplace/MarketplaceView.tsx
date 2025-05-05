import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { cn } from "@/lib/utils"
import { MarketplaceItem, MarketplaceSource } from "../../../../src/services/marketplace/types"
import { validateSource } from "../../../../src/shared/MarketplaceValidation"
import { MarketplaceViewStateManager } from "./MarketplaceViewStateManager"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"
import { MarketplaceItemCard } from "./components/MarketplaceItemCard"
import { useStateManager } from "./useStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import InstallSidebar from "./InstallSidebar"
import { useEvent } from "react-use"
import { ExtensionMessage } from "@roo/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"
import { RocketConfig } from "config-rocket"

interface MarketplaceViewProps {
	onDone?: () => void
	stateManager: MarketplaceViewStateManager
}
const MarketplaceView: React.FC<MarketplaceViewProps> = ({ stateManager }) => {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)

	const [tagSearch, setTagSearch] = useState("")
	const [isTagInputActive, setIsTagInputActive] = useState(false)
	const [showInstallSidebar, setShowInstallSidebar] = useState<
		| {
				item: MarketplaceItem
				config: RocketConfig
		  }
		| false
	>(false)

	const handleInstallSubmit = (item: MarketplaceItem, parameters: Record<string, any>) => {
		vscode.postMessage({
			type: "installMarketplaceItemWithParameters",
			payload: { item, parameters },
		})
		setShowInstallSidebar(false)
	}

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			if (message.type === "openMarketplaceInstallSidebarWithConfig") {
				setShowInstallSidebar({ item: message.payload.item, config: message.payload.config })
			}
		},
		[setShowInstallSidebar],
	)

	useEvent("message", onMessage)

	// Fetch items on first mount or when returning to empty state
	useEffect(() => {
		if (!state.allItems.length && !state.isFetching) {
			manager.transition({ type: "FETCH_ITEMS" })
		}
	}, [manager, state.allItems.length, state.isFetching])

	// Memoize all available tags
	const allTags = useMemo(
		() => Array.from(new Set(state.allItems.flatMap((item) => item.tags || []))).sort(),
		[state.allItems],
	)

	// Memoize filtered tags
	const filteredTags = useMemo(
		() =>
			tagSearch ? allTags.filter((tag: string) => tag.toLowerCase().includes(tagSearch.toLowerCase())) : allTags,
		[allTags, tagSearch],
	)

	return (
		<>
			<Tab>
				<TabHeader className="flex justify-between items-center sticky top-0 z-10 bg-vscode-editor-background border-b border-vscode-panel-border">
					<div className="flex items-center">
						<h3 className="text-vscode-foreground m-0">{t("marketplace:title")}</h3>
					</div>
					<div className="flex gap-2">
						<Button
							variant={state.activeTab === "browse" ? "default" : "secondary"}
							className={cn(
								state.activeTab === "browse" &&
									"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
							)}
							onClick={() => manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "browse" } })}>
							{t("marketplace:tabs.browse")}
						</Button>
						<Button
							variant={state.activeTab === "sources" ? "default" : "secondary"}
							className={cn(
								state.activeTab === "sources" &&
									"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
							)}
							onClick={() => manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "sources" } })}>
							{t("marketplace:tabs.sources")}
						</Button>
					</div>
				</TabHeader>

				<TabContent>
					{state.activeTab === "browse" ? (
						<>
							<div className="mb-4">
								<input
									type="text"
									placeholder={t("marketplace:filters.search.placeholder")}
									value={state.filters.search}
									onChange={(e) =>
										manager.transition({
											type: "UPDATE_FILTERS",
											payload: { filters: { search: e.target.value } },
										})
									}
									className="w-full p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
								/>
								<div className="flex flex-col gap-3 mt-2">
									<div className="flex flex-wrap justify-between gap-2">
										<div className="whitespace-nowrap">
											<label htmlFor="type-filter" className="mr-2">
												{t("marketplace:filters.type.label")}
											</label>
											<select
												id="type-filter"
												value={state.filters.type}
												onChange={(e) =>
													manager.transition({
														type: "UPDATE_FILTERS",
														payload: { filters: { type: e.target.value } },
													})
												}
												className="p-1 bg-vscode-dropdown-background text-vscode-dropdown-foreground border border-vscode-dropdown-border rounded">
												<option value="">{t("marketplace:filters.type.all")}</option>
												<option value="mode">{t("marketplace:filters.type.mode")}</option>
												<option value="mcp server">
													{t("marketplace:filters.type.mcp server")}
												</option>
												<option value="prompt">{t("marketplace:filters.type.prompt")}</option>
												<option value="package">{t("marketplace:filters.type.package")}</option>
											</select>
										</div>

										<div className="whitespace-nowrap">
											<label className="mr-2">{t("marketplace:filters.sort.label")}</label>
											<select
												value={state.sortConfig.by}
												onChange={(e) =>
													manager.transition({
														type: "UPDATE_SORT",
														payload: { sortConfig: { by: e.target.value as any } },
													})
												}
												className="p-1 bg-vscode-dropdown-background text-vscode-dropdown-foreground border border-vscode-dropdown-border rounded mr-2">
												<option value="name">{t("marketplace:filters.sort.name")}</option>
												<option value="lastUpdated">
													{t("marketplace:filters.sort.lastUpdated")}
												</option>
											</select>
											<button
												onClick={() =>
													manager.transition({
														type: "UPDATE_SORT",
														payload: {
															sortConfig: {
																order:
																	state.sortConfig.order === "asc" ? "desc" : "asc",
															},
														},
													})
												}
												className="p-1 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded">
												{state.sortConfig.order === "asc" ? "↑" : "↓"}
											</button>
										</div>
									</div>

									{allTags.length > 0 && (
										<div>
											<div className="flex items-center justify-between mb-1">
												<div className="flex items-center">
													<label className="mr-2">
														{t("marketplace:filters.tags.label")}
													</label>
													<span className="text-xs text-vscode-descriptionForeground">
														{t("marketplace:filters.tags.available", {
															count: allTags.length,
														})}
													</span>
												</div>
												{state.filters.tags.length > 0 && (
													<button
														onClick={() =>
															manager.transition({
																type: "UPDATE_FILTERS",
																payload: { filters: { tags: [] } },
															})
														}
														className="p-1 bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded text-xs">
														{t("marketplace:filters.tags.clear", {
															count: state.filters.tags.length,
														})}
													</button>
												)}
											</div>
											<Command className="rounded-lg border border-vscode-dropdown-border">
												<CommandInput
													placeholder={t("marketplace:filters.tags.placeholder")}
													value={tagSearch}
													onValueChange={setTagSearch}
													onFocus={() => setIsTagInputActive(true)}
													onBlur={(e) => {
														if (!e.relatedTarget?.closest("[cmdk-list]")) {
															setIsTagInputActive(false)
														}
													}}
													className="w-full p-1 bg-vscode-input-background text-vscode-input-foreground border-b border-vscode-dropdown-border"
												/>
												{(isTagInputActive || tagSearch) && (
													<CommandList className="max-h-[200px] overflow-y-auto bg-vscode-dropdown-background">
														<CommandEmpty className="p-2 text-sm text-vscode-descriptionForeground">
															{t("marketplace:filters.tags.noResults")}
														</CommandEmpty>
														<CommandGroup>
															{filteredTags.map((tag: string) => (
																<CommandItem
																	key={tag}
																	onSelect={() => {
																		const isSelected =
																			state.filters.tags.includes(tag)
																		if (isSelected) {
																			manager.transition({
																				type: "UPDATE_FILTERS",
																				payload: {
																					filters: {
																						tags: state.filters.tags.filter(
																							(t) => t !== tag,
																						),
																					},
																				},
																			})
																		} else {
																			manager.transition({
																				type: "UPDATE_FILTERS",
																				payload: {
																					filters: {
																						tags: [
																							...state.filters.tags,
																							tag,
																						],
																					},
																				},
																			})
																		}
																	}}
																	className={`flex items-center gap-2 p-1 cursor-pointer text-sm hover:bg-vscode-button-secondaryBackground ${
																		state.filters.tags.includes(tag)
																			? "bg-vscode-button-background text-vscode-button-foreground"
																			: "text-vscode-dropdown-foreground"
																	}`}
																	onMouseDown={(e) => {
																		e.preventDefault()
																	}}>
																	<span
																		className={`codicon ${state.filters.tags.includes(tag) ? "codicon-check" : ""}`}
																	/>
																	{tag}
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												)}
											</Command>
											<div className="text-xs text-vscode-descriptionForeground mt-1">
												{state.filters.tags.length > 0
													? t("marketplace:filters.tags.selected", {
															count: state.filters.tags.length,
														})
													: t("marketplace:filters.tags.clickToFilter")}
											</div>
										</div>
									)}
								</div>
							</div>

							{(() => {
								// Use items directly from backend
								const items = state.displayItems || []
								const isEmpty = items.length === 0

								// Only show loading state if we're fetching and have no items to display
								if (state.isFetching && isEmpty) {
									return (
										<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground">
											<p>{t("marketplace:items.refresh.refreshing")}</p>
										</div>
									)
								}

								// Show empty state if no items
								if (isEmpty) {
									return (
										<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground">
											<p>{t("marketplace:items.empty.noItems")}</p>
										</div>
									)
								}

								// Show items view
								return (
									<div>
										<p className="text-vscode-descriptionForeground mb-4">
											{t("marketplace:items.count", { count: items.length })}
										</p>
										<div className="grid grid-cols-1 gap-4 pb-4">
											{items.map((item) => (
												<MarketplaceItemCard
													key={`${item.repoUrl}-${item.name}`}
													item={item}
													filters={state.filters}
													setFilters={(filters) =>
														manager.transition({
															type: "UPDATE_FILTERS",
															payload: { filters },
														})
													}
													activeTab={state.activeTab}
													setActiveTab={(tab) =>
														manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab } })
													}
												/>
											))}
										</div>
									</div>
								)
							})()}
						</>
					) : (
						<MarketplaceSourcesConfig
							sources={state.sources}
							refreshingUrls={state.refreshingUrls}
							onRefreshSource={(url) => manager.transition({ type: "REFRESH_SOURCE", payload: { url } })}
							onSourcesChange={(sources) =>
								manager.transition({ type: "UPDATE_SOURCES", payload: { sources } })
							}
						/>
					)}
				</TabContent>
			</Tab>

			{showInstallSidebar && (
				<InstallSidebar
					onClose={() => setShowInstallSidebar(false)}
					onSubmit={handleInstallSubmit}
					item={showInstallSidebar.item}
					config={showInstallSidebar.config}
				/>
			)}
		</>
	)
}

export interface MarketplaceSourcesConfigProps {
	sources: MarketplaceSource[]
	refreshingUrls: string[]
	onRefreshSource: (url: string) => void
	onSourcesChange: (sources: MarketplaceSource[]) => void
}

export const MarketplaceSourcesConfig: React.FC<MarketplaceSourcesConfigProps> = ({
	sources,
	refreshingUrls,
	onRefreshSource,
	onSourcesChange,
}) => {
	const { t } = useAppTranslation()
	const [newSourceUrl, setNewSourceUrl] = useState("")
	const [newSourceName, setNewSourceName] = useState("")
	const [error, setError] = useState("")

	const handleAddSource = () => {
		// Check max sources limit first
		const MAX_SOURCES = 10
		if (sources.length >= MAX_SOURCES) {
			setError(t("marketplace:sources.errors.maxSources", { max: MAX_SOURCES }))
			return
		}

		// Create source object for validation
		const sourceToValidate: MarketplaceSource = {
			url: newSourceUrl,
			name: newSourceName || undefined,
			enabled: true,
		}

		// Validate using shared validation
		const validationErrors = validateSource(sourceToValidate, sources)
		if (validationErrors.length > 0) {
			// Map validation errors to UI error messages
			const errorMessages: Record<string, string> = {
				"url:empty": "marketplace:sources.errors.emptyUrl",
				"url:nonvisible": "marketplace:sources.errors.nonVisibleChars",
				"url:invalid": "marketplace:sources.errors.invalidGitUrl",
				"url:duplicate": "marketplace:sources.errors.duplicateUrl",
				"name:length": "marketplace:sources.errors.nameTooLong",
				"name:nonvisible": "marketplace:sources.errors.nonVisibleCharsName",
				"name:duplicate": "marketplace:sources.errors.duplicateName",
			}

			const error = validationErrors[0]
			const errorKey = `${error.field}:${error.message.toLowerCase().split(" ")[0]}`
			setError(t(errorMessages[errorKey] || "marketplace:sources.errors.invalidGitUrl"))
			return
		}

		// Add the validated source
		onSourcesChange([...sources, sourceToValidate])

		onSourcesChange([...sources, sourceToValidate])

		// Reset form state
		setNewSourceUrl("")
		setNewSourceName("")
		setError("")
	}

	const handleToggleSource = useCallback(
		(index: number) => {
			onSourcesChange(
				sources.map((source, i) => (i === index ? { ...source, enabled: !source.enabled } : source)),
			)
		},
		[sources, onSourcesChange],
	)

	const handleRemoveSource = useCallback(
		(index: number) => {
			onSourcesChange(sources.filter((_, i) => i !== index))
		},
		[sources, onSourcesChange],
	)

	return (
		<div>
			<h4 className="text-vscode-foreground mb-2">{t("marketplace:sources.title")}</h4>
			<p className="text-vscode-descriptionForeground mb-4">{t("marketplace:sources.description")}</p>

			<div className="mb-6">
				<h5 className="text-vscode-foreground mb-2">{t("marketplace:sources.add.title")}</h5>
				<div className="flex flex-col gap-2 mb-2">
					<input
						type="text"
						placeholder={t("marketplace:sources.add.urlPlaceholder")}
						value={newSourceUrl}
						onChange={(e) => {
							setNewSourceUrl(e.target.value)
							setError("")
						}}
						className="p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
					/>
					<p className="text-xs text-vscode-descriptionForeground mt-1 mb-2">
						{t("marketplace:sources.add.urlFormats")}
					</p>
					<input
						type="text"
						placeholder={t("marketplace:sources.add.namePlaceholder")}
						value={newSourceName}
						onChange={(e) => {
							setNewSourceName(e.target.value.slice(0, 20))
							setError("")
						}}
						maxLength={20}
						className="p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
					/>
				</div>
				{error && <p className="text-red-500 mb-2">{error}</p>}
				<Button onClick={handleAddSource}>
					<span className="codicon codicon-add mr-2"></span>
					{t("marketplace:sources.add.button")}
				</Button>
			</div>
			<h5 className="text-vscode-foreground mb-2">
				{t("marketplace:sources.current.title")}{" "}
				<span className="text-vscode-descriptionForeground text-sm">
					{t("marketplace:sources.current.count", { current: sources.length, max: 10 })}
				</span>
			</h5>
			{sources.length === 0 ? (
				<p className="text-vscode-descriptionForeground">{t("marketplace:sources.current.empty")}</p>
			) : (
				<div className="grid grid-cols-1 gap-2">
					{sources.map((source, index) => (
						<div
							key={source.url}
							className="flex items-center justify-between p-3 border border-vscode-panel-border rounded-md bg-vscode-panel-background">
							<div className="flex-1">
								<div className="flex items-center">
									<input
										type="checkbox"
										checked={source.enabled}
										onChange={() => handleToggleSource(index)}
										className="mr-2"
									/>
									<div>
										<p className="text-vscode-foreground font-medium">
											{source.name || source.url}
										</p>
										{source.name && (
											<p className="text-xs text-vscode-descriptionForeground">{source.url}</p>
										)}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => onRefreshSource(source.url)}
									title={t("marketplace:sources.current.refresh")}
									className="text-vscode-foreground"
									disabled={refreshingUrls.includes(source.url)}>
									<span
										className={`codicon ${refreshingUrls.includes(source.url) ? "codicon-sync codicon-modifier-spin" : "codicon-refresh"}`}></span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleRemoveSource(index)}
									title={t("marketplace:sources.current.remove")}
									className="text-red-500">
									<span className="codicon codicon-trash"></span>
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default MarketplaceView
