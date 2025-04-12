import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"
import DynamicTextArea from "react-textarea-autosize"

import { mentionRegex, mentionRegexGlobal } from "../../../../src/shared/context-mentions"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"
import { Mode, getAllModes } from "../../../../src/shared/modes"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"

import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
	SearchResult,
} from "@/utils/context-mentions"
import { SelectDropdown, DropdownOptionType, Button } from "@/components/ui"
import Thumbnails from "../common/Thumbnails"
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
		ref,
	) => {
		const { t } = useAppTranslation()
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			listApiConfigMeta,
			customModes,
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
		// --- 必须严格修改消息监听 useEffect --- (根据规划修改)
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data // The JSON data our extension sent

				switch (message.type) {
					case "enhancedPrompt":
						if (message.text) {
							setInputValue(message.text)
						}
						setIsEnhancingPrompt(false)
						break
					case "commitSearchResults": {
						const commits = message.commits.map((commit: any) => ({
							type: ContextMenuOptionType.Git,
							value: commit.hash,
							label: commit.subject,
							description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
							icon: "$(git-commit)",
						}))
						setGitCommits(commits)
						break
					}
					case "fileSearchResults":
						setSearchLoading(false)
						if (message.requestId === searchRequestId) {
							setFileSearchResults(message.results || [])
						}
						break

					// 必须添加此 case (根据规划添加)
					case "mentionPathsResponse": {
						const validPaths = message.mentionPaths?.filter((path: string): path is string => !!path) || [] // 添加显式类型 string (修复 TS 错误)
						if (validPaths.length > 0) {
							// 必须更新 pendingInsertions 状态
							setPendingInsertions((prev) => [...prev, ...validPaths])
						}
						break
					}
					// ... 其他 case ...
				}
			}

			window.addEventListener("message", messageHandler)
			// Clean up
			return () => window.removeEventListener("message", messageHandler)
		}, [setInputValue, searchRequestId /* , 确保其他依赖项完整 */]) // 确保依赖项完整
		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		// 必须定义此状态 (根据规划添加)
		const [pendingInsertions, setPendingInsertions] = useState<string[]>([])
		// 必须定义此状态 (已存在)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
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

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					// Handle mode selection.
					setMode(value)
					setInputValue("")
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

					// Scroll to cursor.
					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[setInputValue, cursorPosition],
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
								fileSearchResults,
								getAllModes(customModes),
							)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							// Find selectable options (non-URL types)
							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1 // No selectable options

							// Find the index of the next selectable option
							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							// Find the index of the selected option in the original options array
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
							fileSearchResults,
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
					// checks if char before cusor is whitespace after a mention
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$")) // "$" is added to ensure the match occurs at the end of the string
					) {
						const newCursorPosition = cursorPosition - 1
						// if mention is followed by another word, then instead of deleting the space separating them we just move the cursor to the end of the mention
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
							setIntendedCursorPosition(newPosition) // Store the new cursor position in state
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
				fileSearchResults,
			],
		)

		// --- 必须添加用于应用光标位置的 useLayoutEffect --- (已存在，符合规划)
		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				// 必须应用光标位置
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				// 必须重置，防止重复应用
				setIntendedCursorPosition(null)
			}
		}, [inputValue, intendedCursorPosition]) // 必须包含正确的依赖项
		// Ref to store the search timeout
		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				const newCursorPosition = e.target.selectionStart
				setInputValue(newValue)
				setCursorPosition(newCursorPosition)
				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)

				setShowContextMenu(showMenu)
				if (showMenu) {
					if (newValue.startsWith("/")) {
						// Handle slash command
						const query = newValue
						setSearchQuery(query)
						setSelectedMenuIndex(0)
					} else {
						// Existing @ mention handling
						const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
						const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
						setSearchQuery(query)

						// Send file search request if query is not empty
						if (query.length > 0) {
							setSelectedMenuIndex(0)
							// Don't clear results until we have new ones
							// This prevents flickering

							// Clear any existing timeout
							if (searchTimeoutRef.current) {
								clearTimeout(searchTimeoutRef.current)
							}

							// Set a timeout to debounce the search requests
							searchTimeoutRef.current = setTimeout(() => {
								// Generate a request ID for this search
								const reqId = Math.random().toString(36).substring(2, 9)
								setSearchRequestId(reqId)
								setSearchLoading(true)

								// Send message to extension to search files
								vscode.postMessage({
									type: "searchFiles",
									query: query,
									requestId: reqId,
								})
							}, 200) // 200ms debounce
						} else {
							setSelectedMenuIndex(3) // Set to "File" option by default
						}
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
					setFileSearchResults([]) // Clear file search results
				}
			},
			[setInputValue, setSearchRequestId, setFileSearchResults, setSearchLoading],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it.
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
			}

			setIsFocused(false)
		}, [isMouseDownOnMenu])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				// Check if the pasted content is a URL, add space after so user
				// can easily delete if they don't want it.
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

					// Scroll to new cursor position.
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

				if (!shouldDisableImages && imageItems.length > 0) {
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
									console.error(t("chat:errorReadingFile"), reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
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
						console.warn(t("chat:noValidImages"))
					}
				}
			},
			[shouldDisableImages, setSelectedImages, cursorPosition, setInputValue, inputValue, t],
		)

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const text = textAreaRef.current.value

			highlightLayerRef.current.innerHTML = text
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
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

		// --- 必须严格修改 onDrop (或 handleDrop) 函数 --- (根据规划重写)
		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				setIsDraggingOver(false) // 假设有此状态

				// --- 1. 核心：处理 VSCode 拖拽 ---
				let uris: string[] = []
				const vscodeUriListData = e.dataTransfer.getData("application/vnd.code.uri-list") // 必须检查这个
				const resourceUrlsData = e.dataTransfer.getData("resourceurls") // 也要检查这个

				// 优先使用 application/vnd.code.uri-list
				if (vscodeUriListData) {
					uris = vscodeUriListData
						.split("\n")
						.map((uri) => uri.trim())
						.filter((uri) => uri)
				} else if (resourceUrlsData) {
					// 回退到 resourceurls
					try {
						// 注意：resourceUrlsData 是 JSON 字符串数组
						const parsedUris = JSON.parse(resourceUrlsData) as string[]
						uris = parsedUris.map((uri) => decodeURIComponent(uri)).filter((uri) => uri)
					} catch (error) {
						console.error("Failed to parse resourceurls JSON:", error)
						uris = []
					}
				}

				// 过滤有效的 URI (file: 或 vscode-file:)
				const validUris = uris.filter(
					(uri) => uri && (uri.startsWith("vscode-file:") || uri.startsWith("file:")),
				)

				if (validUris.length > 0) {
					// 必须清空待插入项
					setPendingInsertions([])
					// 必须记录初始光标位置
					let initialCursorPos = inputValue.length
					if (textAreaRef.current) {
						initialCursorPos =
							textAreaRef.current.selectionStart >= 0
								? textAreaRef.current.selectionStart
								: inputValue.length
					}
					setIntendedCursorPosition(initialCursorPos)

					// 必须发送此消息
					vscode.postMessage({
						type: "getMentionPathsFromUris",
						uris: validUris,
					})
					return // 处理完毕，不再执行后续逻辑
				}

				// --- 2. 移除或注释掉无关逻辑 ---
				// 🚨 下面的 text/plain 处理逻辑与本次任务无关，必须移除或注释掉！
				/*
				const text = e.dataTransfer.getData("text")
				if (text) {
					// handleTextDrop(text) // 移除或注释掉这部分
					return
				}
				*/

				// --- 3. 其他拖拽处理 (例如图片) ---
				const files = Array.from(e.dataTransfer.files)
				if (!textAreaDisabled && files.length > 0) {
					const acceptedTypes = ["png", "jpeg", "webp"]
					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split("/")
						return type === "image" && acceptedTypes.includes(subtype)
					})

					if (!shouldDisableImages && imageFiles.length > 0) {
						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
								const reader = new FileReader()
								reader.onloadend = () => {
									if (reader.error) {
										console.error(t("chat:errorReadingFile"), reader.error)
										resolve(null)
									} else {
										const result = reader.result
										resolve(typeof result === "string" ? result : null)
									}
								}
								reader.readAsDataURL(file)
							})
						})
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
						} else {
							console.warn(t("chat:noValidImages"))
						}
					}
				}
			},
			[
				inputValue,
				setIntendedCursorPosition,
				setPendingInsertions, // 添加依赖
				textAreaDisabled,
				shouldDisableImages,
				setSelectedImages,
				t,
			],
		)

		const [isTtsPlaying, setIsTtsPlaying] = useState(false)

		useEvent("message", (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ttsStart") {
				setIsTtsPlaying(true)
			} else if (message.type === "ttsStop") {
				setIsTtsPlaying(false)
			}
		})

		// --- 必须严格修改此 useEffect 以处理多个插入 --- (根据规划重写)
		useEffect(() => {
			// 确保 textAreaRef.current 存在且 pendingInsertions 有内容
			if (pendingInsertions.length > 0 && textAreaRef.current) {
				const currentTextArea = textAreaRef.current // 引用当前文本区域
				// 将所有待插入路径用空格连接成一个字符串
				const textToInsert = pendingInsertions.join(" ")
				// 获取当前光标位置，若无则取输入值末尾
				const currentCursorPos = currentTextArea.selectionStart ?? inputValue.length
				// 确定插入起始位置：优先使用记录的拖放初始位置，否则使用当前光标位置
				const startPos = intendedCursorPosition ?? currentCursorPos

				// 构建插入后的新输入值
				const newValue =
					inputValue.substring(0, startPos) + // 插入点之前的部分
					textToInsert + // 要插入的所有路径字符串
					" " + // 在所有路径后追加一个空格，以便继续输入
					inputValue.substring(startPos) // 插入点之后的部分

				// 调用回调函数更新父组件或全局状态中的输入值
				// 注意：这里直接调用 setInputValue，因为它是 props 传入的 state setter
				setInputValue(newValue)
				// 一次性清空待插入项数组
				setPendingInsertions([])

				// 计算插入后的新光标位置（位于插入内容和末尾空格之后）
				const newCursorPos = startPos + textToInsert.length + 1 // +1 是因为加了空格

				// 使用 requestAnimationFrame 确保在 DOM 更新后设置光标和焦点
				requestAnimationFrame(() => {
					if (textAreaRef.current) {
						textAreaRef.current.selectionStart = newCursorPos
						textAreaRef.current.selectionEnd = newCursorPos
						// 确保文本区域获得焦点，以便用户可以立即输入
						textAreaRef.current.focus()
					}
				})

				// 重置记录的初始光标位置
				setIntendedCursorPosition(null)
			}
			// 依赖项数组：当这些值变化时，此 effect 会重新运行
			// 需要包含所有在 effect 内部使用的、可能变化的外部变量/状态/回调
		}, [pendingInsertions, inputValue, setInputValue, intendedCursorPosition, setIntendedCursorPosition]) // 确保依赖项完整

		const placeholderBottomText = `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		return (
			<div
				className={cn(
					"relative",
					"flex",
					"flex-col",
					"gap-2",
					"bg-editor-background",
					"m-2 mt-1",
					"p-1.5",
					"outline-none",
					"border",
					"border-none",
					"w-[calc(100%-16px)]",
					"ml-auto",
					"mr-auto",
					"box-border",
				)}>
				<div className="relative">
					<div
						className={cn("chat-text-area", "relative", "flex", "flex-col", "outline-none")}
						onDrop={handleDrop}
						onDragOver={(e) => {
							//Only allowed to drop images/files on shift key pressed
							if (!e.shiftKey) {
								setIsDraggingOver(false)
								return
							}
							e.preventDefault()
							setIsDraggingOver(true)
							e.dataTransfer.dropEffect = "copy"
						}}
						onDragLeave={(e) => {
							e.preventDefault()
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
								className={cn(
									"absolute",
									"bottom-full",
									"left-0",
									"right-0",
									"z-[1000]",
									"mb-2",
									"filter",
									"drop-shadow-md",
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={searchQuery}
									onMouseDown={handleMenuMouseDown}
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex}
									selectedType={selectedType}
									queryItems={queryItems}
									modes={getAllModes(customModes)}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
								/>
							</div>
						)}
						<div
							className={cn(
								"relative",
								"flex-1",
								"flex",
								"flex-col-reverse",
								"min-h-0",
								"overflow-hidden",
								"rounded",
							)}>
							<div
								ref={highlightLayerRef}
								className={cn(
									"absolute",
									"inset-0",
									"pointer-events-none",
									"whitespace-pre-wrap",
									"break-words",
									"text-transparent",
									"overflow-hidden",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									"py-2",
									"px-[9px]",
									"z-10",
								)}
								style={{
									color: "transparent",
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
								onChange={(e) => {
									handleInputChange(e)
									updateHighlights()
								}}
								onFocus={() => setIsFocused(true)}
								onKeyDown={handleKeyDown}
								onKeyUp={handleKeyUp}
								onBlur={handleBlur}
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
								className={cn(
									"w-full",
									"text-vscode-input-foreground",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									textAreaDisabled ? "cursor-not-allowed" : "cursor-text",
									"py-1.5 px-2",
									isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
										: isDraggingOver
											? "border-2 border-dashed border-vscode-focusBorder"
											: "border border-transparent",
									textAreaDisabled ? "opacity-50" : "opacity-100",
									isDraggingOver
										? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
										: "bg-vscode-input-background",
									"transition-background-color duration-150 ease-in-out",
									"will-change-background-color",
									"h-[100px]",
									"[@media(min-width:150px)]:min-h-[80px]",
									"[@media(min-width:425px)]:min-h-[60px]",
									"box-border",
									"rounded",
									"resize-none",
									"overflow-x-hidden",
									"overflow-y-auto",
									"pr-2",
									"flex-none flex-grow",
									"z-[2]",
									"scrollbar-none",
								)}
								onScroll={() => updateHighlights()}
							/>
							{isTtsPlaying && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute top-0 right-0 opacity-25 hover:opacity-100 z-10"
									onClick={() => vscode.postMessage({ type: "stopTts" })}>
									<VolumeX className="size-4" />
								</Button>
							)}
							{!inputValue && (
								<div
									className={cn(
										"absolute",
										"left-2",
										"flex",
										"gap-2",
										"text-xs",
										"text-descriptionForeground",
										"pointer-events-none",
										"z-25",
										"bottom-1.5",
										"pr-2",
										"transition-opacity",
										"duration-200",
										"ease-in-out",
										textAreaDisabled ? "opacity-35" : "opacity-70",
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
							left: "16px",
							zIndex: 2,
							marginBottom: 0,
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
									setMode(value as Mode)
									vscode.postMessage({ type: "mode", text: value })
								}}
								shortcutText={modeShortcutText}
								triggerClassName="w-full"
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
									(listApiConfigMeta || []).some((config) => !pinnedApiConfigs[config.id])
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
											type: "loadApiConfiguration",
											text: value,
											values: { section: "providers" },
										})
									} else {
										vscode.postMessage({ type: "loadApiConfigurationById", text: value })
									}
								}}
								contentClassName="max-h-[300px] overflow-y-auto"
								triggerClassName="w-full text-ellipsis overflow-hidden"
								itemClassName="group"
								renderItem={({ type, value, label, pinned }) => {
									if (type !== DropdownOptionType.ITEM) {
										return label
									}

									const config = listApiConfigMeta?.find((c) => c.id === value)
									const isCurrentConfig = config?.name === currentApiConfigName

									return (
										<div className="flex justify-between gap-2 w-full h-5">
											<div className={cn({ "font-medium": isCurrentConfig })}>{label}</div>
											<div className="flex justify-end w-10">
												<div
													className={cn("size-5 p-1", {
														"block group-hover:hidden": !pinned,
														hidden: !isCurrentConfig,
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
													className={cn("size-5", {
														"hidden group-hover:flex": !pinned,
														"bg-accent": pinned,
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
							disabled={textAreaDisabled}
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
							disabled={textAreaDisabled}
							onClick={onSend}
						/>
					</div>
				</div>
			</div>
		)
	},
)

export default ChatTextArea
