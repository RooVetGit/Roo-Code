import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import DynamicTextArea from "react-textarea-autosize"
import { mentionRegex, mentionRegexGlobal } from "../../../../../src/shared/context-mentions"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
} from "../../../utils/context-mentions"
import ContextMenu from "../ContextMenu"
import Thumbnails from "../../common/Thumbnails"
import { Mode, getAllModes } from "../../../../../src/shared/modes"
import { MAX_IMAGES_PER_MESSAGE } from "../ChatView"
import { convertToMentionPath } from "../../../utils/path-mentions"
import { vscode } from "../../../utils/vscode"

interface ChatTextAreaInputProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	shouldDisableImages: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onHeightChange?: (height: number) => void
	setMode: (value: Mode) => void
	customModes: any[]
	filePaths: string[]
	openedTabs: Array<{ path?: string }>
	gitCommits: any[]
	cwd?: string
}

const ChatTextAreaInput = React.forwardRef<HTMLTextAreaElement, ChatTextAreaInputProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			shouldDisableImages,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onHeightChange,
			setMode,
			customModes,
			cwd,
			filePaths,
			openedTabs,
			gitCommits,
		},
		ref,
	) => {
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [thumbnailsHeight, setThumbnailsHeight] = useState(0)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [isFocused, setIsFocused] = useState(false)

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
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path))
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					setMode(value)
					setInputValue("")
					setShowContextMenu(false)
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)
				if (textAreaRef.current) {
					let insertValue = value || ""
					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Terminal) {
						insertValue = "terminal"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					}

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						cursorPosition,
						insertValue,
					)

					setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			[setInputValue, cursorPosition, setMode],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3) // File by default
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(
								searchQuery,
								selectedType,
								queryItems,
								getAllModes(customModes),
							)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1

							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(
							searchQuery,
							selectedType,
							queryItems,
							getAllModes(customModes),
						)[selectedMenuIndex]
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

				const isComposing = event.nativeEvent?.isComposing ?? false
				if (event.key === "Enter" && !event.shiftKey && !isComposing) {
					event.preventDefault()
					onSend()
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"
					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}
						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)
						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition)
						}
						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
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
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
				customModes,
			],
		)

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null)
			}
		}, [inputValue, intendedCursorPosition])

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				const newCursorPosition = e.target.selectionStart || 0
				setInputValue(newValue)
				setCursorPosition(newCursorPosition)

				if (newValue === "@" || newValue === "/") {
					setShowContextMenu(true)
					setSearchQuery("")
					setSelectedMenuIndex(newValue === "/" ? 0 : 3)
					return
				}

				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)
				setShowContextMenu(showMenu)

				if (showMenu) {
					if (newValue.startsWith("/")) {
						const query = newValue.slice(1)
						setSearchQuery(query)
						setSelectedMenuIndex(0)
					} else {
						const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
						if (lastAtIndex !== -1) {
							const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
							setSearchQuery(query)
							setSelectedMenuIndex(query.length > 0 ? 0 : 3)
						}
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
				}
			},
			[setInputValue],
		)

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)

					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})
				if (imageItems.length > 0) {
					e.preventDefault()
					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()
							if (!blob) {
								resolve(null)
								return
							}
							const reader = new FileReader()
							reader.onloadend = () => {
								if (reader.error) {
									console.error("Error reading file:", reader.error)
									resolve(null)
								} else {
									resolve(typeof reader.result === "string" ? reader.result : null)
								}
							}
							reader.readAsDataURL(blob)
						})
					})
					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn("No valid images were processed")
					}
				}
			},
			[cursorPosition, setInputValue, inputValue, setSelectedImages],
		)

		const handleThumbnailsHeightChange = useCallback((height: number) => {
			setThumbnailsHeight(height)
		}, [])

		useEffect(() => {
			if (selectedImages.length === 0) {
				setThumbnailsHeight(0)
			}
		}, [selectedImages])

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const text = textAreaRef.current.value

			highlightLayerRef.current.innerHTML = text
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "<", ">": ">", "&": "&amp;" })[c] || c)
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft
		}, [])

		useLayoutEffect(() => {
			updateHighlights()
		}, [inputValue, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		return (
			<div
				className="chat-text-area"
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					minHeight: 0,
					overflow: "visible",
					border: isDraggingOver ? "2px dashed var(--vscode-focusBorder)" : "1px solid transparent",
					borderRadius: 5,
					transition: "border 0.2s ease-in-out, background-color 0.2s ease-in-out",
					backgroundColor: isDraggingOver
						? "color-mix(in srgb, var(--vscode-editor-background) 95%, var(--vscode-focusBorder))"
						: undefined,
				}}
				onDrop={async (e) => {
					e.preventDefault()
					e.stopPropagation()
					setIsDraggingOver(false)

					// Handle text drops
					const text = e.dataTransfer.getData("text")
					if (text) {
						// Split text on newlines to handle multiple files
						const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

						if (lines.length > 0) {
							// Process each line as a separate file path
							let newValue = inputValue.slice(0, cursorPosition)
							let totalLength = 0

							for (const line of lines) {
								// Convert each path to a mention-friendly format
								const mentionPath = convertToMentionPath(line, cwd)
								// If the path is unchanged (outside cwd), use it as is
								const formattedPath = mentionPath === line ? line : mentionPath
								newValue += formattedPath + " "
								totalLength += formattedPath.length + 1
							}

							// Append the rest of the input without extra space
							newValue = newValue.trimEnd() + " " + inputValue.slice(cursorPosition).trimStart()

							setInputValue(newValue)
							const newCursorPosition = cursorPosition + totalLength
							setCursorPosition(newCursorPosition)
							setIntendedCursorPosition(newCursorPosition)
						}
						return
					}

					// Handle file drops
					const files = Array.from(e.dataTransfer.files)
					if (!textAreaDisabled && files.length > 0) {
						const acceptedTypes = ["png", "jpeg", "webp"]
						const imageFiles = files.filter((file) => {
							const [type, subtype] = file.type.split("/")
							return type === "image" && acceptedTypes.includes(subtype)
						})

						if (imageFiles.length > 0) {
							try {
								const imagePromises = imageFiles.map(
									(file) =>
										new Promise<string | null>((resolve) => {
											const reader = new FileReader()
											reader.onloadend = () => {
												if (reader.error) {
													console.error("Error reading file:", reader.error)
													resolve(null)
												} else {
													resolve(typeof reader.result === "string" ? reader.result : null)
												}
											}
											reader.readAsDataURL(file)
										}),
								)

								const imageDataArray = await Promise.all(imagePromises)
								const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
								if (dataUrls.length > 0) {
									setSelectedImages((prevImages) =>
										[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
									)
									if (typeof vscode !== "undefined") {
										vscode.postMessage({
											type: "draggedImages",
											dataUrls: dataUrls,
										})
									}
								}
							} catch (error) {
								console.error("Error processing dropped images:", error)
							}
						}
					}
				}}
				onDragOver={(e) => {
					e.preventDefault()
					e.stopPropagation()
					setIsDraggingOver(true)
					e.dataTransfer.dropEffect = "copy"
				}}
				onDragEnter={(e) => {
					e.preventDefault()
					e.stopPropagation()
				}}
				onDragLeave={(e) => {
					e.preventDefault()
					e.stopPropagation()
					const rect = e.currentTarget.getBoundingClientRect()
					if (
						e.clientX <= rect.left ||
						e.clientX >= rect.right ||
						e.clientY <= rect.top ||
						e.clientY >= rect.bottom
					) {
						setIsDraggingOver(false)
					}
				}}>
				{showContextMenu && (
					<div
						ref={contextMenuContainerRef}
						style={{
							position: "absolute",
							bottom: "100%",
							left: 0,
							right: 0,
							zIndex: 1000,
							marginBottom: "8px",
							filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
						}}>
						<ContextMenu
							onSelect={handleMentionSelect}
							searchQuery={searchQuery}
							onMouseDown={handleMenuMouseDown}
							selectedIndex={selectedMenuIndex}
							setSelectedIndex={setSelectedMenuIndex}
							selectedType={selectedType}
							queryItems={queryItems}
							modes={getAllModes(customModes)}
						/>
					</div>
				)}

				<div
					style={{
						position: "relative",
						flex: "1 1 auto",
						display: "flex",
						flexDirection: "column-reverse",
						minHeight: 0,
						overflow: "hidden",
					}}>
					<div
						ref={highlightLayerRef}
						style={{
							position: "absolute",
							inset: 0,
							pointerEvents: "none",
							whiteSpace: "pre-wrap",
							wordWrap: "break-word",
							color: "transparent",
							overflow: "hidden",
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							padding: "8px",
							paddingRight: "16px",
							marginBottom: thumbnailsHeight > 0 ? `${thumbnailsHeight}px` : 0,
							zIndex: 1,
						}}
					/>
					<DynamicTextArea
						ref={(el) => {
							if (typeof ref === "function") {
								ref(el)
							} else if (ref) {
								ref.current = el
							}
							textAreaRef.current = el
						}}
						value={inputValue}
						disabled={textAreaDisabled}
						onChange={handleInputChange}
						onFocus={() => {
							setIsFocused(true)
							if (inputValue === "@" || inputValue === "/") {
								setShowContextMenu(true)
								setSearchQuery("")
								setSelectedMenuIndex(inputValue === "/" ? 0 : 3)
							}
						}}
						onBlur={(e) => {
							setIsFocused(false)
							if (!isMouseDownOnMenu) {
								setTimeout(() => setShowContextMenu(false), 100)
							}
							setIsMouseDownOnMenu(false)
						}}
						onKeyDown={handleKeyDown}
						onKeyUp={handleKeyUp}
						onPaste={handlePaste}
						onSelect={updateCursorPosition}
						onMouseUp={updateCursorPosition}
						onHeightChange={(height) => {
							if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
								setTextAreaBaseHeight(height)
							}
							onHeightChange?.(height)
						}}
						placeholder={placeholderText}
						minRows={3}
						maxRows={15}
						autoFocus={true}
						style={{
							width: "100%",
							outline: "none",
							boxSizing: "border-box",
							backgroundColor: isFocused
								? "color-mix(in srgb, var(--vscode-editor-background) 95%, var(--vscode-focusBorder))"
								: "var(--vscode-editor-background)",
							color: "var(--vscode-editor-foreground)",
							borderRadius: 5,
							fontFamily: "var(--vscode-font-family)",
							fontSize: "var(--vscode-editor-font-size)",
							lineHeight: "var(--vscode-editor-line-height)",
							resize: "none",
							overflowX: "hidden",
							overflowY: "auto",
							border: "none",
							padding: "8px",
							paddingRight: "16px",
							marginBottom: thumbnailsHeight > 0 ? `${thumbnailsHeight + 16}px` : 0,
							cursor: textAreaDisabled ? "not-allowed" : "text",
							flex: "0 1 auto",
							zIndex: 2,
							scrollbarWidth: "none",
							opacity: textAreaDisabled ? 0.5 : 1,
							position: "relative",
							transition: "background-color 0.2s ease-in-out",
						}}
						onScroll={() => updateHighlights()}
					/>
				</div>
				{!inputValue && (
					<div
						style={{
							position: "absolute",
							left: "8px",
							display: "flex",
							gap: "8px",
							fontSize: "0.7em",
							color: "var(--vscode-descriptionForeground)",
							opacity: 0.8,
							pointerEvents: "none",
							zIndex: 2,
							bottom: thumbnailsHeight > 0 ? `${thumbnailsHeight + 22}px` : 6,
							transition: "opacity 0.2s ease",
						}}>
						<span>[@ Context]</span>
						<span>[/ Modes]</span>
						<span>[⇧ Drag {!shouldDisableImages ? "Files/Images" : "Files"}]</span>
					</div>
				)}
				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
						style={{
							position: "absolute",
							bottom: "0",
							left: "2px",
							zIndex: 2,
							marginBottom: "4px",
						}}
					/>
				)}
			</div>
		)
	},
)

export default ChatTextAreaInput
