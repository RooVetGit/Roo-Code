import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tab, TabContent, TabHeader } from "../common/Tab"
import { cn } from "@/lib/utils"
import { PackageManagerSource } from "../../../../src/services/package-manager/types"
import { PackageManagerViewStateManager } from "./PackageManagerViewStateManager"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"
import { PackageManagerItemCard } from "./components/PackageManagerItemCard"
import { useStateManager } from "./useStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface PackageManagerViewProps {
	onDone?: () => void
	stateManager: PackageManagerViewStateManager
}
const PackageManagerView: React.FC<PackageManagerViewProps> = ({ onDone, stateManager }) => {
	const { t } = useAppTranslation()
	const [state, manager] = useStateManager(stateManager)

	const [tagSearch, setTagSearch] = useState("")
	const [isTagInputActive, setIsTagInputActive] = useState(false)

	// Fetch items on first mount
	useEffect(() => {
		manager.transition({ type: "FETCH_ITEMS" })
	}, [manager])

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
		<Tab>
			<TabHeader className="flex justify-between items-center sticky top-0 z-10 bg-vscode-editor-background border-b border-vscode-panel-border">
				<div className="flex items-center">
					<h3 className="text-vscode-foreground m-0">{t("package-manager:title")}</h3>
				</div>
				<div className="flex gap-2">
					<Button
						variant={state.activeTab === "browse" ? "default" : "secondary"}
						className={cn(
							state.activeTab === "browse" &&
								"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
						)}
						onClick={() => manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "browse" } })}>
						{t("package-manager:tabs.browse")}
					</Button>
					<Button
						variant={state.activeTab === "sources" ? "default" : "secondary"}
						className={cn(
							state.activeTab === "sources" &&
								"bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground",
						)}
						onClick={() => manager.transition({ type: "SET_ACTIVE_TAB", payload: { tab: "sources" } })}>
						{t("package-manager:tabs.sources")}
					</Button>
				</div>
			</TabHeader>

			<TabContent>
				{state.activeTab === "browse" ? (
					<>
						<div className="mb-4">
							<input
								type="text"
								placeholder={t("package-manager:filters.search.placeholder")}
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
											{t("package-manager:filters.type.label")}
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
											<option value="">{t("package-manager:filters.type.all")}</option>
											<option value="mode">{t("package-manager:filters.type.mode")}</option>
											<option value="mcp server">
												{t("package-manager:filters.type.mcp server")}
											</option>
											<option value="prompt">{t("package-manager:filters.type.prompt")}</option>
											<option value="package">{t("package-manager:filters.type.package")}</option>
										</select>
									</div>

									<div className="whitespace-nowrap">
										<label className="mr-2">{t("package-manager:filters.sort.label")}</label>
										<select
											value={state.sortConfig.by}
											onChange={(e) =>
												manager.transition({
													type: "UPDATE_SORT",
													payload: { sortConfig: { by: e.target.value as any } },
												})
											}
											className="p-1 bg-vscode-dropdown-background text-vscode-dropdown-foreground border border-vscode-dropdown-border rounded mr-2">
											<option value="name">{t("package-manager:filters.sort.name")}</option>
											<option value="lastUpdated">
												{t("package-manager:filters.sort.lastUpdated")}
											</option>
										</select>
										<button
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
													{t("package-manager:filters.tags.label")}
												</label>
												<span className="text-xs text-vscode-descriptionForeground">
													{t("package-manager:filters.tags.available", {
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
													{t("package-manager:filters.tags.clear", {
														count: state.filters.tags.length,
													})}
												</button>
											)}
										</div>
										<Command className="rounded-lg border border-vscode-dropdown-border">
											<CommandInput
												placeholder={t("package-manager:filters.tags.placeholder")}
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
														{t("package-manager:filters.tags.noResults")}
													</CommandEmpty>
													<CommandGroup>
														{filteredTags.map((tag: string) => (
															<CommandItem
																key={tag}
																onSelect={() => {
																	const isSelected = state.filters.tags.includes(tag)
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
																					tags: [...state.filters.tags, tag],
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
												? t("package-manager:filters.tags.selected", {
														count: state.filters.tags.length,
													})
												: t("package-manager:filters.tags.clickToFilter")}
										</div>
									</div>
								)}
							</div>
						</div>

						{(() => {
							// Use items directly from backend
							const items = state.displayItems || []
							const isEmpty = items.length === 0
							const isLoading = state.isFetching
							// Show loading state if fetching and not filtering
							// Only show loading state if we're fetching and not filtering
							if (
								isLoading &&
								!(state.filters.type || state.filters.search || state.filters.tags.length > 0)
							) {
								return (
									<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground">
										<p>{t("package-manager:items.refresh.refreshing")}</p>
									</div>
								)
							}

							// Show empty state if no items
							if (isEmpty) {
								return (
									<div className="flex flex-col items-center justify-center h-64 text-vscode-descriptionForeground">
										<p>{t("package-manager:items.empty.noItems")}</p>
									</div>
								)
							}

							// Show items view
							return (
								<div>
									<p className="text-vscode-descriptionForeground mb-4">
										{t("package-manager:items.count", { count: items.length })}
									</p>
									<div className="grid grid-cols-1 gap-4 pb-4">
										{items.map((item) => (
											<PackageManagerItemCard
												key={`${item.repoUrl}-${item.name}`}
												item={item}
												filters={state.filters}
												setFilters={(filters) =>
													manager.transition({ type: "UPDATE_FILTERS", payload: { filters } })
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
					<PackageManagerSourcesConfig
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
	)
}

interface PackageManagerSourcesConfigProps {
	sources: PackageManagerSource[]
	refreshingUrls: string[]
	onRefreshSource: (url: string) => void
	onSourcesChange: (sources: PackageManagerSource[]) => void
}

const PackageManagerSourcesConfig: React.FC<PackageManagerSourcesConfigProps> = ({
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
		if (!newSourceUrl) {
			setError(t("package-manager:sources.errors.emptyUrl"))
			return
		}

		try {
			new URL(newSourceUrl)
		} catch (e) {
			setError(t("package-manager:sources.errors.invalidUrl"))
			return
		}

		const nonVisibleCharRegex = /[^\S ]/
		if (nonVisibleCharRegex.test(newSourceUrl)) {
			setError(t("package-manager:sources.errors.nonVisibleChars"))
			return
		}

		if (!isValidGitRepositoryUrl(newSourceUrl)) {
			setError(t("package-manager:sources.errors.invalidGitUrl"))
			return
		}

		const normalizedNewUrl = newSourceUrl.toLowerCase().replace(/\s+/g, "")
		if (sources.some((source) => source.url.toLowerCase().replace(/\s+/g, "") === normalizedNewUrl)) {
			setError(t("package-manager:sources.errors.duplicateUrl"))
			return
		}

		if (newSourceName) {
			if (newSourceName.length > 20) {
				setError(t("package-manager:sources.errors.nameTooLong"))
				return
			}

			if (nonVisibleCharRegex.test(newSourceName)) {
				setError(t("package-manager:sources.errors.nonVisibleCharsName"))
				return
			}

			const normalizedNewName = newSourceName.toLowerCase().replace(/\s+/g, "")
			if (
				sources.some(
					(source) => source.name && source.name.toLowerCase().replace(/\s+/g, "") === normalizedNewName,
				)
			) {
				setError(t("package-manager:sources.errors.duplicateName"))
				return
			}
		}

		const MAX_SOURCES = 10
		if (sources.length >= MAX_SOURCES) {
			setError(t("package-manager:sources.errors.maxSources", { max: MAX_SOURCES }))
			return
		}

		const newSource: PackageManagerSource = {
			url: newSourceUrl,
			name: newSourceName || undefined,
			enabled: true,
		}

		onSourcesChange([...sources, newSource])

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
			<h4 className="text-vscode-foreground mb-2">{t("package-manager:sources.title")}</h4>
			<p className="text-vscode-descriptionForeground mb-4">{t("package-manager:sources.description")}</p>

			<div className="mb-6">
				<h5 className="text-vscode-foreground mb-2">{t("package-manager:sources.add.title")}</h5>
				<div className="flex flex-col gap-2 mb-2">
					<input
						type="text"
						placeholder={t("package-manager:sources.add.urlPlaceholder")}
						value={newSourceUrl}
						onChange={(e) => {
							setNewSourceUrl(e.target.value)
							setError("")
						}}
						className="p-2 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded"
					/>
					<p className="text-xs text-vscode-descriptionForeground mt-1 mb-2">
						{t("package-manager:sources.add.urlFormats")}
					</p>
					<input
						type="text"
						placeholder={t("package-manager:sources.add.namePlaceholder")}
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
					{t("package-manager:sources.add.button")}
				</Button>
			</div>
			<h5 className="text-vscode-foreground mb-2">
				{t("package-manager:sources.current.title")}{" "}
				<span className="text-vscode-descriptionForeground text-sm">
					{t("package-manager:sources.current.count", { current: sources.length, max: 10 })}
				</span>
			</h5>
			{sources.length === 0 ? (
				<p className="text-vscode-descriptionForeground">{t("package-manager:sources.current.empty")}</p>
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
									title={t("package-manager:sources.current.refresh")}
									className="text-vscode-foreground"
									disabled={refreshingUrls.includes(source.url)}>
									<span
										className={`codicon ${refreshingUrls.includes(source.url) ? "codicon-sync codicon-modifier-spin" : "codicon-refresh"}`}></span>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => handleRemoveSource(index)}
									title={t("package-manager:sources.current.remove")}
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

const isValidGitRepositoryUrl = (url: string): boolean => {
	const trimmedUrl = url.trim()

	const httpsPattern =
		/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\/.+)*(\.git)?$/
	const sshPattern = /^git@(github\.com|gitlab\.com|bitbucket\.org):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(\.git)?$/
	const gitProtocolPattern =
		/^git:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/

	return httpsPattern.test(trimmedUrl) || sshPattern.test(trimmedUrl) || gitProtocolPattern.test(trimmedUrl)
}

export default PackageManagerView
