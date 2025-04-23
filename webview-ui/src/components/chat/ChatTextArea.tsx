import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"

import { WebviewMessage } from "@roo/shared/WebviewMessage"
import { Mode, getAllModes } from "@roo/shared/modes"
import { ExtensionMessage } from "@roo/shared/ExtensionMessage"

import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ContextMenuOptionType, getContextMenuOptions, SearchResult } from "@src/utils/context-mentions"
import { SelectDropdown, DropdownOptionType, Button } from "@/components/ui"

import Thumbnails from "../common/Thumbnails"
import LexicalTextArea, { LexicalTextAreaHandle, INSERT_MENTION_COMMAND } from "../LexicalTextArea" // Import Lexical components
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import ContextMenu from "./ContextMenu"
import { VolumeX, Pin, Check } from "lucide-react"
import { IconButton } from "./IconButton"
import { cn } from "@/lib/utils"

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	selectApiConfigDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
	modeShortcutText: string
}

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			selectApiConfigDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			mode,
			setMode,
			modeShortcutText,
		},
		ref, // Keep the forwarded ref, even if unused by LexicalTextAreaComponent itself
	) => {
		const { t } = useAppTranslation()
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			listApiConfigMeta,
			customModes,
			cwd,
			pinnedApiConfigs,
			togglePinnedApiConfig,
		} = useExtensionState()

		// Find the ID and display text for the currently selected API configuration
		const { currentConfigId, displayName } = useMemo(() => {
			const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
			return {
				currentConfigId: currentConfig?.id || "",
				displayName: currentApiConfigName || "", // Use the name directly for display
			}
		}, [listApiConfigMeta, currentApiConfigName])

		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [showDropdown, setShowDropdown] = useState(false)
		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])
		const [searchLoading, setSearchLoading] = useState(false)
		const [searchRequestId, setSearchRequestId] = useState<string>("")

		// Close dropdown when clicking outside.
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}
			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

		// Handle enhanced prompt response and search results.
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data

				if (message.type === "enhancedPrompt") {
					if (message.text) {
						setInputValue(message.text) // Still needed for enhance prompt
					}
					setIsEnhancingPrompt(false)
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))
					setGitCommits(commits)
				} else if (message.type === "fileSearchResults") {
					setSearchLoading(false)
					if (message.requestId === searchRequestId) {
						setFileSearchResults(message.results || [])
					}
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [setInputValue, searchRequestId]) // Keep setInputValue dependency

		// Removed isDraggingOver state

		const [showContextMenu, setShowContextMenu] = useState(false)
		const [contextMenuType, setContextMenuType] = useState<"mention" | "command" | null>(null)
		const [searchQuery, setSearchQuery] = useState("")
		const lexicalTextAreaRef = useRef<LexicalTextAreaHandle | null>(null) // Ref for Lexical component handle
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [isFocused, setIsFocused] = useState(false)

		// Fetch git commits when Git is selected or when typing a hash.
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [selectedType, searchQuery])

		const handleEnhancePrompt = useCallback(() => {
			if (!textAreaDisabled) {
				const trimmedInput = inputValue.trim()
				if (trimmedInput) {
					setIsEnhancingPrompt(true)
					const message = {
						type: "enhancePrompt" as const,
						text: trimmedInput,
					}
					vscode.postMessage(message)
				} else {
					const promptDescription = t("chat:enhancePromptDescription")
					setInputValue(promptDescription)
				}
			}
		}, [inputValue, textAreaDisabled, setInputValue, t])

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path)) // Filter out paths that are already in openedTabs
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		const handleShowContextMenu = useCallback((show: boolean, type: "mention" | "command" | null) => {
			setShowContextMenu(show)
			setContextMenuType(type)
			if (!show) {
				setSelectedType(null)
				setSearchQuery("")
			}
		}, [])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					// Handle mode selection (remains the same)
					setMode(value as Mode) // Ensure type safety
					setInputValue("") // Clear input on mode change
					setShowContextMenu(false)
					vscode.postMessage({ type: "mode", text: value })
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						// Selecting a category, not a specific item yet
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0) // Reset index for the new category
						// Keep context menu open
						return
					}
				}

				// If we get here, we're inserting a mention
				setShowContextMenu(false)
				setSelectedType(null)
				setSearchQuery("") // Clear search query

				// Construct the full mention value (e.g., "@file:/path/to/file.txt")
				let mentionValue = ""
				if (type === ContextMenuOptionType.URL) {
					mentionValue = `@url:${value || ""}`
				} else if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.OpenedFile
				) {
					// Assuming 'value' already includes the leading '/'
					mentionValue = `@file:${value || ""}`
				} else if (type === ContextMenuOptionType.Problems) {
					mentionValue = "@problems"
				} else if (type === ContextMenuOptionType.Terminal) {
					mentionValue = "@terminal"
				} else if (type === ContextMenuOptionType.Git) {
					mentionValue = `@git:${value || ""}`
				}

				// Dispatch command to Lexical editor
				if (lexicalTextAreaRef.current && mentionValue) {
					lexicalTextAreaRef.current.dispatchCommand(INSERT_MENTION_COMMAND, mentionValue)
				}
				// Lexical handles the insertion and cursor positioning internally
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[setMode, lexicalTextAreaRef], // Updated dependencies
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						event.preventDefault() // Prevent potential browser behavior
						setShowContextMenu(false) // Close menu on Escape
						setSelectedType(null)
						setSearchQuery("")
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(
								searchQuery,
								inputValue, // Keep inputValue for context if needed by getContextMenuOptions
								selectedType,
								queryItems,
								fileSearchResults,
								getAllModes(customModes),
							)
							const optionsLength = options.length

							if (optionsLength === 0) return -1 // No options, keep -1

							// Filter out non-selectable options (e.g., URL, NoResults)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1 // No selectable options

							// Find the current index within the *selectable* options
							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => options[prevIndex] === option, // Compare based on the original index
							)

							let newSelectableIndex
							if (currentSelectableIndex === -1) {
								// If previous index wasn't selectable or was -1, start from top/bottom
								newSelectableIndex = direction === 1 ? 0 : selectableOptions.length - 1
							} else {
								newSelectableIndex =
									(currentSelectableIndex + direction + selectableOptions.length) %
									selectableOptions.length
							}

							// Find the index of the new selected option in the *original* options array
							const newOriginalIndex = options.findIndex(
								(option) => option === selectableOptions[newSelectableIndex],
							)
							return newOriginalIndex // Return the index in the original array
						})
						return
					}

					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const options = getContextMenuOptions(
							// Recalculate options here
							searchQuery,
							inputValue,
							selectedType,
							queryItems,
							fileSearchResults,
							getAllModes(customModes),
						)
						const selectedOption = options[selectedMenuIndex] // Get option using the current index

						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				// Let Lexical handle Enter/Shift+Enter for line breaks/sending unless context menu is open
				if (!showContextMenu) {
					const isComposing = event.nativeEvent?.isComposing ?? false
					if (event.key === "Enter" && !event.shiftKey && !isComposing) {
						event.preventDefault()
						onSend() // Keep Enter key for sending when context menu is closed
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				queryItems,
				customModes,
				fileSearchResults,
			],
		)

		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		// Effect to trigger file search when mention query changes
		useEffect(() => {
			if (contextMenuType === "mention" && selectedType !== ContextMenuOptionType.Git && searchQuery.length > 0) {
				// Only search files if not in Git mode
				setSelectedMenuIndex(0) // Reset selection on new query

				// Clear any existing timeout
				if (searchTimeoutRef.current) {
					clearTimeout(searchTimeoutRef.current)
				}

				// Set a timeout to debounce the search requests
				searchTimeoutRef.current = setTimeout(() => {
					const reqId = Math.random().toString(36).substring(2, 9)
					setSearchRequestId(reqId)
					setSearchLoading(true)
					setFileSearchResults([]) // Clear previous results immediately before new search

					vscode.postMessage({
						type: "searchFiles",
						query: searchQuery,
						requestId: reqId,
					})
				}, 200) // 200ms debounce
			} else if (contextMenuType === "mention" && searchQuery.length === 0) {
				// Clear timeout and results if query becomes empty
				if (searchTimeoutRef.current) {
					clearTimeout(searchTimeoutRef.current)
				}
				setSearchLoading(false)
				setFileSearchResults([])
				setSelectedMenuIndex(selectedType === null ? 3 : 0) // Default to "File" if no type selected, else 0
			} else if (contextMenuType !== "mention" || selectedType === ContextMenuOptionType.Git) {
				// Also clear if not mention mode or if Git mode
				// Clear search state if not in mention mode or if searching Git
				if (searchTimeoutRef.current) {
					clearTimeout(searchTimeoutRef.current)
				}
				setSearchLoading(false)
				setFileSearchResults([])
			}

			return () => {
				if (searchTimeoutRef.current) {
					clearTimeout(searchTimeoutRef.current)
				}
			}
		}, [searchQuery, contextMenuType, selectedType])

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Use setTimeout to allow click event on context menu to register first
			setTimeout(() => {
				if (!isMouseDownOnMenu) {
					setShowContextMenu(false)
				}
			}, 100) // Small delay
			setIsFocused(false)
			setIsMouseDownOnMenu(false) // Reset mouse down flag on blur regardless
		}, [isMouseDownOnMenu]) // Keep dependency

		// Removed handlePaste - Lexical handles paste internally

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		// Removed updateHighlights, useLayoutEffect for highlights, updateCursorPosition, handleKeyUp
		// Removed handleDrop - Lexical handles drop internally

		const [isTtsPlaying, setIsTtsPlaying] = useState(false)

		useEvent("message", (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ttsStart") {
				setIsTtsPlaying(true)
			} else if (message.type === "ttsStop") {
				setIsTtsPlaying(false)
			}
		})

		const placeholderBottomText = `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		return (
			<div
				className={cn(
					"relative",
					"flex",
					"flex-col",
					"gap-2",
					"m-2 mt-1",
					"p-1.5",
					"outline-none",
					"border-none",
					"w-[calc(100%-16px)]",
					"ml-auto",
					"mr-auto",
					"box-border",
				)}>
				<div className="relative">
					<div className={cn("chat-text-area", "relative", "flex", "flex-col", "outline-none")}>
						{showContextMenu && (
							<div
								ref={contextMenuContainerRef}
								onMouseDown={handleMenuMouseDown} // Attach mouse down here to prevent blur closing menu
								className={cn(
									"absolute",
									"bottom-full", // Position above the text area
									"left-0",
									"right-0",
									"z-[1000]", // High z-index
									"mb-1", // Small margin below menu
									"filter",
									"drop-shadow-md", // Use drop shadow for better visibility
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={searchQuery}
									inputValue={inputValue} // Pass inputValue
									onMouseDown={handleMenuMouseDown} // Pass onMouseDown
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex} // Pass setter
									selectedType={selectedType}
									queryItems={queryItems}
									modes={getAllModes(customModes)}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
								/>
							</div>
						)}
						{/* Container for Lexical and placeholder */}
						<div
							className={cn(
								"relative", // Needed for absolute positioning of placeholder/TTS button
								"flex-1",
								"flex",
								"flex-col", // Ensure vertical layout if needed
								"min-h-0", // Allow shrinking
								"overflow-hidden", // Hide overflow
								"rounded", // Apply rounding
								"border border-input", // Use standard input border
								isFocused ? "ring-1 ring-ring" : "", // Focus ring like ShadCN Input
								"bg-input", // Use input background
							)}>
							{/* Removed highlightLayerRef div */}
							<LexicalTextArea
								ref={lexicalTextAreaRef}
								value={inputValue}
								disabled={textAreaDisabled}
								onChange={setInputValue}
								placeholder={placeholderText}
								autoFocus={true}
								cwd={cwd ?? ""}
								onFocus={() => setIsFocused(true)}
								onKeyDown={handleKeyDown}
								onBlur={handleBlur}
								onHeightChange={onHeightChange}
								onShowContextMenu={handleShowContextMenu}
								onMentionQueryChange={(value) => setSearchQuery(value)}
								onCommandQueryChange={(value) => setSearchQuery(value)}
								onImagesPasted={(dataUrls) =>
									setSelectedImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
								}
								onImagesDropped={(dataUrls) =>
									setSelectedImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
								}
							/>
							{isTtsPlaying && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute top-1 right-1 opacity-50 hover:opacity-100 z-10" // Adjusted position
									onClick={() => vscode.postMessage({ type: "stopTts" })}>
									<VolumeX className="size-4" />
								</Button>
							)}
							{!inputValue && (
								<div
									className={cn(
										"absolute",
										"left-2", // Match Lexical's padding
										"flex",
										"gap-2",
										"text-xs",
										"text-descriptionForeground", // Use VSCode variable
										"pointer-events-none",
										"z-0", // Behind the text caret
										"bottom-1.5", // Position at the bottom
										"pr-2", // Padding right
										"transition-opacity",
										"duration-200",
										"ease-in-out",
										textAreaDisabled ? "opacity-35" : "opacity-70", // Adjust opacity
									)}>
									{placeholderBottomText}
								</div>
							)}
						</div>
					</div>
				</div>

				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						style={{
							// Adjust positioning if needed, maybe relative to the main container
							// left: "16px", // This might be off now
							zIndex: 2,
							marginBottom: 0, // Keep close to text area
						}}
					/>
				)}

				<div className={cn("flex", "justify-between", "items-center", "mt-auto", "pt-0.5")}>
					<div className={cn("flex", "items-center", "gap-1", "min-w-0")}>
						{/* Mode selector - fixed width */}
						<div className="shrink-0">
							<SelectDropdown
								value={mode}
								title={t("chat:selectMode")}
								options={[
									{
										value: "shortcut",
										label: modeShortcutText,
										disabled: true,
										type: DropdownOptionType.SHORTCUT,
									},
									...getAllModes(customModes).map((mode) => ({
										value: mode.slug,
										label: mode.name,
										type: DropdownOptionType.ITEM,
									})),
									{
										value: "sep-1",
										label: t("chat:separator"),
										type: DropdownOptionType.SEPARATOR,
									},
									{
										value: "promptsButtonClicked",
										label: t("chat:edit"),
										type: DropdownOptionType.ACTION,
									},
								]}
								onChange={(value) => {
									if (value === "promptsButtonClicked") {
										// Use "loadApiConfiguration" with values payload to target the modes section, similar to API config edit
										vscode.postMessage({
											type: "loadApiConfiguration",
											values: { section: "modes" },
										})
									} else {
										setMode(value as Mode)
										vscode.postMessage({ type: "mode", text: value })
									}
								}}
								shortcutText={modeShortcutText}
								triggerClassName="w-full" // Ensure it takes available space
							/>
						</div>

						{/* API configuration selector - flexible width */}
						<div className={cn("flex-1", "min-w-0", "overflow-hidden")}>
							<SelectDropdown
								value={currentConfigId}
								disabled={selectApiConfigDisabled}
								title={t("chat:selectApiConfig")}
								placeholder={displayName} // Always show the current name
								options={[
									// Pinned items first
									...(listApiConfigMeta || [])
										.filter((config) => pinnedApiConfigs && pinnedApiConfigs[config.id])
										.map((config) => ({
											value: config.id,
											label: config.name,
											name: config.name, // Keep name for comparison with currentApiConfigName
											type: DropdownOptionType.ITEM,
											pinned: true,
										}))
										.sort((a, b) => a.label.localeCompare(b.label)),
									// If we have pinned items and unpinned items, add a separator
									...(pinnedApiConfigs &&
									Object.keys(pinnedApiConfigs).length > 0 &&
									(listApiConfigMeta || []).some(
										(config) => !pinnedApiConfigs || !pinnedApiConfigs[config.id],
									) // Check if there are unpinned items
										? [
												{
													value: "sep-pinned",
													label: t("chat:separator"),
													type: DropdownOptionType.SEPARATOR,
												},
											]
										: []),
									// Unpinned items sorted alphabetically
									...(listApiConfigMeta || [])
										.filter((config) => !pinnedApiConfigs || !pinnedApiConfigs[config.id])
										.map((config) => ({
											value: config.id,
											label: config.name,
											name: config.name, // Keep name for comparison with currentApiConfigName
											type: DropdownOptionType.ITEM,
											pinned: false,
										}))
										.sort((a, b) => a.label.localeCompare(b.label)),
									{
										value: "sep-2",
										label: t("chat:separator"),
										type: DropdownOptionType.SEPARATOR,
									},
									{
										value: "settingsButtonClicked",
										label: t("chat:edit"),
										type: DropdownOptionType.ACTION,
									},
								]}
								onChange={(value) => {
									if (value === "settingsButtonClicked") {
										vscode.postMessage({
											type: "loadApiConfiguration", // Keep original message type
											text: value, // Keep original text value
											values: { section: "providers" }, // Keep original values
										})
									} else {
										vscode.postMessage({ type: "loadApiConfigurationById", text: value })
									}
								}}
								triggerClassName="w-full text-ellipsis overflow-hidden" // Ensure text truncates
								itemClassName="group"
								renderItem={({ type, value, label, pinned }) => {
									if (type !== DropdownOptionType.ITEM) {
										return label
									}

									const config = listApiConfigMeta?.find((c) => c.id === value)
									const isCurrentConfig = config?.name === currentApiConfigName

									return (
										<div className="flex justify-between items-center gap-2 w-full h-5">
											{" "}
											{/* Ensure items-center */}
											<div className={cn("truncate", { "font-medium": isCurrentConfig })}>
												{label}
											</div>{" "}
											{/* Add truncate */}
											<div className="flex justify-end items-center w-10 shrink-0">
												{" "}
												{/* Ensure items-center and shrink-0 */}
												<div
													className={cn("size-5 p-1 flex items-center justify-center", {
														// Center checkmark
														"block group-hover:hidden": !pinned, // Show check only if current and not hovered (unless pinned)
														hidden: !isCurrentConfig, // Hide if not current
													})}>
													<Check className="size-3" />
												</div>
												<Button
													variant="ghost"
													size="icon"
													title={pinned ? t("chat:unpin") : t("chat:pin")}
													onClick={(e) => {
														e.stopPropagation()
														togglePinnedApiConfig(value)
														vscode.postMessage({ type: "toggleApiConfigPin", text: value })
													}}
													className={cn("size-5 flex items-center justify-center", {
														// Center pin icon
														"hidden group-hover:flex": !pinned, // Show pin on hover if not pinned
														"flex bg-accent": pinned, // Always show pin if pinned, with accent
													})}>
													<Pin className="size-3 p-0.5 opacity-50" />
												</Button>
											</div>
										</div>
									)
								}}
							/>
						</div>
					</div>

					{/* Right side - action buttons */}
					<div className={cn("flex", "items-center", "gap-0.5", "shrink-0")}>
						<IconButton
							iconClass={isEnhancingPrompt ? "codicon-loading" : "codicon-sparkle"}
							title={t("chat:enhancePrompt")}
							disabled={textAreaDisabled || !inputValue.trim()} // Disable if no input
							isLoading={isEnhancingPrompt}
							onClick={handleEnhancePrompt}
						/>
						<IconButton
							iconClass="codicon-device-camera"
							title={t("chat:addImages")}
							disabled={shouldDisableImages}
							onClick={onSelectImages}
						/>
						<IconButton
							iconClass="codicon-send"
							title={t("chat:sendMessage")}
							disabled={textAreaDisabled || (!inputValue.trim() && selectedImages.length === 0)} // Disable if no text and no images
							onClick={onSend}
						/>
					</div>
				</div>
			</div>
		)
	},
)

export default ChatTextArea
