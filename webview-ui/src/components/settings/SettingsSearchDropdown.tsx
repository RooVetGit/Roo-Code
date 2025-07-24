import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, X, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@src/components/ui"
import { searchSettings, getSearchableSettings, type SearchableItem } from "./searchUtils"

interface SettingsSearchDropdownProps {
	onSelectSetting: (sectionId: string, settingId: string) => void
	className?: string
}

export const SettingsSearchDropdown: React.FC<SettingsSearchDropdownProps> = ({ onSelectSetting, className }) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])

	// Get searchable settings
	const searchableSettings = useMemo(() => getSearchableSettings(t), [t])

	// Perform search
	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return []
		return searchSettings(searchQuery, searchableSettings)
	}, [searchQuery, searchableSettings])

	// Flatten results for keyboard navigation
	const flattenedResults = useMemo(() => {
		const items: { item: SearchableItem; sectionId: string }[] = []
		searchResults.forEach((result) => {
			result.matches.forEach((match) => {
				items.push({ item: match, sectionId: result.sectionId })
			})
		})
		return items
	}, [searchResults])

	// Handle search toggle
	const handleSearchToggle = useCallback(() => {
		setIsExpanded(!isExpanded)
		if (!isExpanded) {
			// Focus the input when expanding
			setTimeout(() => searchInputRef.current?.focus(), 100)
		} else {
			// Clear search when collapsing
			setSearchQuery("")
			setIsDropdownOpen(false)
			setSelectedIndex(-1)
		}
	}, [isExpanded])

	// Handle search clear
	const handleSearchClear = useCallback(() => {
		setSearchQuery("")
		setSelectedIndex(-1)
		searchInputRef.current?.focus()
	}, [])

	// Handle search input change
	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		setSearchQuery(value)
		setSelectedIndex(-1)
		setIsDropdownOpen(value.trim().length > 0)
	}, [])

	// Handle item selection
	const handleSelectItem = useCallback(
		(sectionId: string, settingId: string) => {
			onSelectSetting(sectionId, settingId)
			setSearchQuery("")
			setIsDropdownOpen(false)
			setIsExpanded(false)
			setSelectedIndex(-1)
		},
		[onSelectSetting],
	)

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!isDropdownOpen || flattenedResults.length === 0) {
				if (e.key === "Escape" && isExpanded) {
					setIsExpanded(false)
					setSearchQuery("")
					setIsDropdownOpen(false)
				}
				return
			}

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault()
					setSelectedIndex((prev) => (prev < flattenedResults.length - 1 ? prev + 1 : 0))
					break
				case "ArrowUp":
					e.preventDefault()
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flattenedResults.length - 1))
					break
				case "Enter":
					e.preventDefault()
					if (selectedIndex >= 0 && selectedIndex < flattenedResults.length) {
						const selected = flattenedResults[selectedIndex]
						handleSelectItem(selected.sectionId, selected.item.settingId)
					}
					break
				case "Escape":
					e.preventDefault()
					setIsDropdownOpen(false)
					setSearchQuery("")
					setIsExpanded(false)
					setSelectedIndex(-1)
					break
			}
		},
		[isDropdownOpen, flattenedResults, selectedIndex, handleSelectItem, isExpanded],
	)

	// Scroll selected item into view
	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	// Handle clicks outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				searchInputRef.current &&
				!searchInputRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false)
			}
		}

		if (isDropdownOpen) {
			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [isDropdownOpen])

	// Reset selected index when results change
	useEffect(() => {
		setSelectedIndex(-1)
		itemRefs.current = []
	}, [searchResults])

	return (
		<div className={cn("relative flex items-center", className)}>
			<div
				className={cn(
					"flex items-center gap-1 transition-all duration-300 ease-in-out",
					isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden pointer-events-none",
				)}>
				<Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
					<PopoverTrigger asChild>
						<div className="relative">
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={handleSearchChange}
								onKeyDown={handleKeyDown}
								placeholder={t("settings:header.searchPlaceholder")}
								className="w-48 h-7 px-2 pr-7 text-sm rounded bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground focus:outline-none focus-visible:outline-none border-0 focus:border-0 focus-visible:border-0"
								style={{
									border: "none",
									outline: "none",
									boxShadow: "none",
								}}
							/>
							{searchQuery && (
								<StandardTooltip content={t("settings:header.clearSearchTooltip")}>
									<button
										onClick={handleSearchClear}
										className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-vscode-toolbar-hoverBackground rounded"
										aria-label={t("settings:header.clearSearchTooltip")}>
										<X className="w-3 h-3 text-vscode-icon-foreground" />
									</button>
								</StandardTooltip>
							)}
						</div>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						sideOffset={4}
						className="w-96 p-0 max-h-96 overflow-hidden mr-2"
						onOpenAutoFocus={(e) => e.preventDefault()}>
						<div ref={dropdownRef} className="overflow-y-auto max-h-96">
							{searchResults.length === 0 ? (
								<div className="p-4 text-center text-vscode-descriptionForeground">
									<p className="text-sm">{t("settings:header.noSearchResults")}</p>
									<p className="text-xs mt-1">&ldquo;{searchQuery}&rdquo;</p>
								</div>
							) : (
								<div className="py-1">
									{searchResults.map((result, resultIndex) => (
										<div key={result.sectionId}>
											{resultIndex > 0 && (
												<div className="mx-2 my-1 h-px bg-vscode-dropdown-border" />
											)}
											<div className="px-3 py-1.5 text-xs font-medium text-vscode-descriptionForeground">
												{result.matches[0].sectionLabel}
											</div>
											{result.matches.map((match) => {
												const globalIndex = flattenedResults.findIndex(
													(item) =>
														item.sectionId === result.sectionId &&
														item.item.settingId === match.settingId,
												)
												const isSelected = selectedIndex === globalIndex

												return (
													<div
														key={match.settingId}
														ref={(el) => {
															if (globalIndex >= 0) {
																itemRefs.current[globalIndex] = el
															}
														}}
														onClick={() =>
															handleSelectItem(result.sectionId, match.settingId)
														}
														className={cn(
															"px-3 py-2 cursor-pointer flex items-center justify-between group",
															"hover:bg-vscode-list-hoverBackground",
															isSelected && "bg-vscode-list-activeSelectionBackground",
														)}>
														<div className="flex-1 min-w-0">
															<div className="text-sm text-vscode-foreground">
																{match.settingLabel}
															</div>
															{match.settingDescription && (
																<div className="text-xs text-vscode-descriptionForeground mt-0.5 truncate">
																	{match.settingDescription}
																</div>
															)}
														</div>
														<ChevronRight
															className={cn(
																"w-4 h-4 text-vscode-icon-foreground opacity-0 group-hover:opacity-100 transition-opacity",
																isSelected && "opacity-100",
															)}
														/>
													</div>
												)
											})}
										</div>
									))}
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			<StandardTooltip content={t("settings:header.searchTooltip")}>
				<button
					onClick={handleSearchToggle}
					className="p-1.5 hover:bg-vscode-toolbar-hoverBackground rounded"
					aria-label={t("settings:header.searchTooltip")}>
					<Search className="w-4 h-4 text-vscode-icon-foreground" />
				</button>
			</StandardTooltip>
		</div>
	)
}
