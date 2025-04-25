import React, {
	useEffect,
	useRef,
	useLayoutEffect,
	useState,
	forwardRef,
	useImperativeHandle,
	ForwardedRef,
} from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import {
	$getRoot,
	$createParagraphNode,
	$createTextNode,
	$getSelection,
	$isRangeSelection,
	$isElementNode,
	CLEAR_HISTORY_COMMAND,
	COMMAND_PRIORITY_EDITOR,
	createCommand,
	LexicalNode,
	LexicalCommand,
	TextNode,
	$setSelection,
	KEY_BACKSPACE_COMMAND,
	PASTE_COMMAND,
	$insertNodes,
} from "lexical"
import { cn } from "../lib/utils"
import { convertToMentionPath } from "../utils/path-mentions"
import { MentionNode, $createMentionNode, $isMentionNode } from "./lexical-nodes/MentionNode"

const editorConfig = {
	namespace: "LexicalTextArea",
	theme: {
		paragraph: "m-0",
		mention: "mention-highlight",
	},
	onError(error: Error) {
		console.error("Lexical Error:", error)
	},
	nodes: [MentionNode],
}

// --- Lexical Commands ---
export const INSERT_MENTION_COMMAND = createCommand<string>("insert_mention")

interface LexicalTextAreaProps {
	value: string
	onChange: (value: string) => void
	placeholder: string
	disabled: boolean
	autoFocus: boolean
	onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
	onFocus: (event: React.FocusEvent<HTMLDivElement>) => void
	onBlur: (event: React.FocusEvent<HTMLDivElement>) => void

	onShowContextMenu: (show: boolean, type: "mention" | "command" | null) => void
	onMentionQueryChange: (query: string) => void
	onCommandQueryChange: (query: string) => void

	onImagesPasted: (dataUrls: string[]) => void
	onImagesDropped: (dataUrls: string[]) => void

	onHeightChange?: (height: number) => void
	cwd: string
}

export interface LexicalTextAreaHandle {
	dispatchCommand: <P>(command: LexicalCommand<P>, payload: P) => boolean
}

type AutosizePluginProps = {
	contentEditableRef: React.RefObject<HTMLDivElement>
	onHeightChange?: (height: number) => void
}
function AutosizePlugin(props: AutosizePluginProps) {
	const [editor] = useLexicalComposerContext()
	const [minHeight, setMinHeight] = useState<number | undefined>(undefined)

	useLayoutEffect(() => {
		const measure = () => {
			const element = props.contentEditableRef.current
			if (element) {
				element.style.height = "auto"
				const newScrollHeight = element.scrollHeight

				if (minHeight === undefined) {
					setMinHeight(newScrollHeight)
				}

				const currentMinHeight = minHeight ?? newScrollHeight

				const newHeight = Math.max(currentMinHeight, newScrollHeight)
				element.style.height = `${newHeight}px`

				props.onHeightChange?.(newHeight)
			}
		}

		measure()

		const observer = new ResizeObserver(measure)
		const element = props.contentEditableRef.current
		if (element) {
			observer.observe(element)
		}

		const unregisterUpdate = editor.registerUpdateListener(() => requestAnimationFrame(measure))

		return () => {
			if (element) {
				observer.unobserve(element)
			}
			unregisterUpdate()
		}
	}, [editor, props, minHeight])

	return null
}

const LexicalTextArea = forwardRef<LexicalTextAreaHandle, LexicalTextAreaProps>(
	(
		{
			value,
			onChange,
			placeholder,
			disabled,
			autoFocus,
			onKeyDown,
			onFocus,
			onBlur,
			onShowContextMenu,
			onMentionQueryChange,
			onCommandQueryChange,
			onImagesPasted,
			onImagesDropped,
			onHeightChange,
			cwd,
		},
		ref: ForwardedRef<LexicalTextAreaHandle>,
	) => {
		const [editor] = useLexicalComposerContext()
		const isFirstRender = useRef(true)
		const contentEditableRef = useRef<HTMLDivElement | null>(null)
		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [isFocused, setIsFocused] = useState(autoFocus)

		// --- Imperative Handle ---
		useImperativeHandle(
			ref,
			() => ({
				dispatchCommand: <P,>(command: LexicalCommand<P>, payload: P) => {
					return editor.dispatchCommand(command, payload)
				},
			}),
			[editor],
		)

		// --- Initial Value Sync ---
		useLayoutEffect(() => {
			if (isFirstRender.current) {
				isFirstRender.current = false

				editor.update(() => {
					const root = $getRoot()
					root.clear()
					const paragraph = $createParagraphNode()
					paragraph.append($createTextNode(value))
					root.append(paragraph)
				})

				editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined)
			} else {
				editor.getEditorState().read(() => {
					const currentText = $getRoot().getTextContent()
					if (currentText !== value) {
						editor.update(() => {
							const root = $getRoot()
							root.clear()
							const paragraph = $createParagraphNode()
							paragraph.append($createTextNode(value))
							root.append(paragraph)
						})

						editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined)
					}
				})
			}
		}, [value, editor])

		// --- Event Handlers ---
		const handleInternalFocus = (event: React.FocusEvent<HTMLDivElement>) => {
			setIsFocused(true)
			onFocus(event)
		}

		const handleInternalBlur = (event: React.FocusEvent<HTMLDivElement>) => {
			setTimeout(() => {
				setIsFocused(false)
				onBlur(event)
			}, 100)
		}

		const handleKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
			// Context Menu Logic - Check before Lexical update
			let showMenu = false
			let menuType: "mention" | "command" | null = null
			let query = ""

			editor.getEditorState().read(() => {
				const selection = $getSelection()

				if ($isRangeSelection(selection) && selection.isCollapsed()) {
					const anchor = selection.anchor
					const anchorNode = anchor.getNode()
					const anchorOffset = anchor.offset

					let textBeforeCursor = ""

					if ($isRangeSelection(selection) && selection.isCollapsed() && anchorNode instanceof TextNode) {
						const textContent = anchorNode.getTextContent()
						textBeforeCursor = textContent.substring(0, anchorOffset)

						const root = $getRoot()
						const firstParagraph = root.getFirstChild()

						// handles mode switch
						if ($isElementNode(firstParagraph)) {
							const firstTextNode = firstParagraph.getFirstChild()
							if (anchorNode === firstTextNode && textBeforeCursor.startsWith("/")) {
								showMenu = true
								menuType = "command"
								query = textBeforeCursor.substring(1)
							}
						}
					}

					// handles mention
					if (!showMenu) {
						// Check if the pressed key is '@'
						if (event.key === "@") {
							// Check if '@' is at the start or preceded by whitespace in the current text before cursor
							const charBeforeCursor =
								textBeforeCursor.length > 0 ? textBeforeCursor[textBeforeCursor.length - 1] : null
							if (
								textBeforeCursor.length === 0 ||
								(charBeforeCursor !== null && /\s/.test(charBeforeCursor))
							) {
								showMenu = true
								menuType = "mention"
								query = "" // Initial query is empty after typing '@'
							}
						} else {
							// For other keys, check if we are currently in a mention query
							const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/)
							if (mentionMatch) {
								const charBeforeMention = textBeforeCursor[mentionMatch.index! - 1]
								if (mentionMatch.index === 0 || /\s/.test(charBeforeMention)) {
									showMenu = true
									menuType = "mention"
									query = mentionMatch[1] || ""
								}
							}
						}
					}
				}
			})

			// If Enter is pressed and a menu is expected, prevent default behavior
			if (event.key === "Enter" && showMenu) {
				event.preventDefault()
				event.stopPropagation()
				// Do not return here, allow the rest of the handler to update menu state
			}

			console.log({ showMenu, menuType })

			// Call context menu handlers immediately
			onShowContextMenu(showMenu, menuType)
			if (menuType === "mention") {
				onMentionQueryChange(query)
				onCommandQueryChange("")
			} else if (menuType === "command") {
				onCommandQueryChange(query)
				onMentionQueryChange("")
			} else {
				onCommandQueryChange("")
				onMentionQueryChange("")
			}

			// Continue with Lexical update for text content changes
			editor.update(() => {
				if (isFirstRender.current) {
					isFirstRender.current = false
					return
				}

				const plainText = $getRoot().getTextContent()

				// if the text content is not equal to the value, update the value
				if (plainText !== value) {
					onChange(plainText)
				}
			})

			onKeyDown(event)
		}

		// --- Drop/Drag Handlers ---
		const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault()
			setIsDraggingOver(false)
			const dataTransfer = event.dataTransfer

			if (!dataTransfer) return

			// --- Image Dropping ---
			const files = Array.from(dataTransfer.files)
			const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"]
			const imageFiles = files.filter((file) => acceptedImageTypes.includes(file.type))

			if (imageFiles.length > 0 && onImagesDropped) {
				const imagePromises = imageFiles.map((file) => {
					return new Promise<string | null>((resolve) => {
						const reader = new FileReader()
						reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
						reader.onerror = () => {
							console.error("Error reading dropped file")
							resolve(null)
						}
						reader.readAsDataURL(file)
					})
				})
				const dataUrls = (await Promise.all(imagePromises)).filter((url): url is string => url !== null)
				if (dataUrls.length > 0) {
					onImagesDropped(dataUrls)
				}
				return // Prevent further processing if images were handled
			}

			// --- Text/Path Dropping ---
			const textUriList = dataTransfer.getData("application/vnd.code.uri-list")
			const textFieldList = dataTransfer.getData("text/plain")
			const text = textFieldList || textUriList

			if (text) {
				const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")
				if (lines.length > 0) {
					editor.update(() => {
						const selection = $getSelection()
						if (!$isRangeSelection(selection)) return

						const nodesToInsert: LexicalNode[] = []

						lines.forEach((line, index) => {
							const mentionText = convertToMentionPath(line, cwd)
							nodesToInsert.push($createMentionNode(mentionText))
							if (index < lines.length - 1) {
								nodesToInsert.push($createTextNode(" ")) // Add space between mentions
							}
						})

						nodesToInsert.push($createTextNode(" ")) // Add trailing space

						selection.insertNodes(nodesToInsert)

						// Move cursor after the inserted content
						const lastNode = nodesToInsert[nodesToInsert.length - 1]
						if (lastNode) {
							lastNode.selectEnd()
						}
					})
				}
				return
			}
		}

		const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
			// Require Shift key to indicate a copy operation for dropping
			if (!event.shiftKey) {
				setIsDraggingOver(false)
				event.dataTransfer.dropEffect = "none" // Indicate no drop allowed
				return
			}
			event.preventDefault() // Necessary to allow drop
			setIsDraggingOver(true)
			event.dataTransfer.dropEffect = "copy" // Indicate a copy operation
		}

		const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
			// Check if the mouse truly left the element bounds
			const rect = event.currentTarget.getBoundingClientRect()
			if (
				event.clientX <= rect.left ||
				event.clientX >= rect.right ||
				event.clientY <= rect.top ||
				event.clientY >= rect.bottom
			) {
				setIsDraggingOver(false)
			}
		}
		// --- End Drop/Drag Handlers ---

		// --- Command Registrations ---
		useEffect(() => {
			const unregisterInsertMention = editor.registerCommand<string>(
				INSERT_MENTION_COMMAND,
				(payload) => {
					editor.update(() => {
						const selection = $getSelection()
						if ($isRangeSelection(selection)) {
							const mentionTextToInsert = payload
							const anchorNode = selection.anchor.getNode()
							const anchorOffset = selection.anchor.offset

							let startOffset = -1
							if (anchorNode instanceof TextNode) {
								const textContent = anchorNode.getTextContent().substring(0, anchorOffset)
								startOffset = textContent.lastIndexOf("@")
								// Ensure '@' is at the start or preceded by whitespace
								if (startOffset > 0 && !/\s/.test(textContent[startOffset - 1])) {
									startOffset = -1
								}
							}

							if (startOffset !== -1 && anchorNode instanceof TextNode) {
								// Replace the typed query (@...) with the mention node
								const mentionNode = $createMentionNode(mentionTextToInsert)
								const spaceNode = $createTextNode(" ")

								// Split the text node at the start of the query
								const textNodeBefore = anchorNode.splitText(startOffset)[0] || anchorNode
								// Split the remaining part at the end of the query
								const textNodeAfter = textNodeBefore.splitText(anchorOffset - startOffset)[1]

								// Insert the mention and space
								textNodeBefore.insertAfter(mentionNode)
								mentionNode.insertAfter(spaceNode)

								// Re-attach the text after the query if it exists
								if (textNodeAfter) {
									spaceNode.insertAfter(textNodeAfter)
								}

								// Move cursor after the inserted space
								spaceNode.selectEnd()
							} else {
								// Insert mention at the current cursor position
								const mentionNode = $createMentionNode(mentionTextToInsert)
								const spaceNode = $createTextNode(" ")
								selection.insertNodes([mentionNode, spaceNode])
								// Move cursor after the inserted space
								$setSelection(selection.clone()) // Update selection state
							}
						}
					})
					return true // Command handled
				},
				COMMAND_PRIORITY_EDITOR,
			)

			const unregisterBackspace = editor.registerCommand<KeyboardEvent>(
				KEY_BACKSPACE_COMMAND,
				(event) => {
					const selection = $getSelection()

					if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
						return false // Let Lexical handle non-collapsed selections or non-range selections
					}

					const anchor = selection.anchor
					const anchorNode = anchor.getNode()
					const anchorOffset = anchor.offset

					const isPreviousSiblingMention = (node: LexicalNode | null): boolean => {
						if (!node) return false
						const prevSibling = node.getPreviousSibling()
						return $isMentionNode(prevSibling)
					}

					// Special handling for deleting the space immediately after a mention
					if (
						anchorOffset === 1 && // Cursor is at offset 1 (after the space)
						anchorNode instanceof TextNode &&
						anchorNode.getTextContent() === " " && // The node is just a space
						isPreviousSiblingMention(anchorNode) // The previous sibling is a MentionNode
					) {
						event.preventDefault() // Prevent default backspace behavior
						const mentionNode = anchorNode.getPreviousSibling()
						if (mentionNode) {
							mentionNode.selectEnd() // Select the end of the mention node
							anchorNode.remove() // Remove the space node
						}
						return true // Command handled
					}

					// Let Lexical handle other backspace scenarios
					// (including deleting a selected MentionNode, regular text, etc.)
					return false
				},
				COMMAND_PRIORITY_EDITOR,
			)

			const unregisterPaste = editor.registerCommand<ClipboardEvent>(
				PASTE_COMMAND,
				(event) => {
					const clipboardData = event.clipboardData
					if (!clipboardData) {
						return false
					}

					const items = Array.from(clipboardData.items)

					// --- Image Pasting ---
					const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"]
					const imageItems = items.filter(
						(item) => item.kind === "file" && acceptedImageTypes.includes(item.type),
					)

					if (imageItems.length > 0 && onImagesPasted) {
						event.preventDefault() // Prevent default paste behavior

						const processImages = async () => {
							const imagePromises = imageItems.map((item) => {
								return new Promise<string | null>((resolve) => {
									const blob = item.getAsFile()
									if (!blob) {
										resolve(null)
										return
									}
									const reader = new FileReader()
									reader.onloadend = () => {
										resolve(typeof reader.result === "string" ? reader.result : null)
									}
									reader.onerror = () => {
										console.error("Error reading pasted file")
										resolve(null)
									}
									reader.readAsDataURL(blob)
								})
							})
							const dataUrls = (await Promise.all(imagePromises)).filter(
								(url): url is string => url !== null,
							)
							if (dataUrls.length > 0) {
								onImagesPasted(dataUrls) // Pass data URLs to the parent
							}
						}
						processImages()

						return true // Command handled
					}

					// --- URL Pasting ---
					const pastedText = clipboardData.getData("text/plain")
					const urlRegex = /^\s*(https?:\/\/\S+)\s*$/i // Matches URLs that are the only content
					const urlMatch = pastedText.match(urlRegex)

					if (urlMatch) {
						event.preventDefault() // Prevent default paste behavior
						const url = urlMatch[1]
						editor.update(() => {
							const selection = $getSelection()
							if ($isRangeSelection(selection)) {
								const urlNode = $createTextNode(url)
								const spaceNode = $createTextNode(" ") // Add space after URL

								$insertNodes([urlNode, spaceNode]) // Insert URL and space

								spaceNode.selectEnd() // Move cursor after the space
							}
						})
						return true // Command handled
					}

					// Let Lexical handle default text pasting
					return false
				},
				COMMAND_PRIORITY_EDITOR,
			)

			return () => {
				unregisterInsertMention()
				unregisterBackspace()
				unregisterPaste()
			}
		}, [editor, onImagesPasted])
		// --- End Command Registrations ---

		useEffect(() => {
			if (autoFocus && contentEditableRef.current) {
				editor.focus()
			}
			editor.setEditable(!disabled)
		}, [editor, autoFocus, disabled])

		return (
			<div className="relative" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
				<RichTextPlugin
					contentEditable={
						<ContentEditable
							ref={contentEditableRef}
							className={cn(
								"lexical-content-editable",
								"w-full",
								"text-vscode-input-foreground",
								"font-vscode-font-family",
								"text-vscode-editor-font-size",
								"leading-vscode-editor-line-height",
								disabled ? "cursor-not-allowed" : "cursor-text",
								"py-1.5 px-2",
								// Dynamic border/background based on state
								editor.isEditable()
									? isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder bg-vscode-input-background" // Focused
										: isDraggingOver
											? "border-2 border-dashed border-vscode-focusBorder bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]" // Dragging over
											: "border border-transparent bg-vscode-input-background" // Idle
									: "border border-transparent bg-vscode-input-background opacity-50", // Disabled
								"rounded",
								"resize-none", // Disable manual resize
								"overflow-x-hidden",
								"overflow-y-auto", // Allow vertical scroll if needed
								"min-h-[60px]", // Minimum height
								"box-border",
								"relative", // Needed for placeholder positioning
								"z-[2]", // Ensure content is above placeholder
								"scrollbar-none", // Hide scrollbar visually
							)}
							style={{
								outline: "none", // Remove default browser outline
								tabSize: 4, // Standard tab size
							}}
							onFocus={handleInternalFocus}
							onBlur={handleInternalBlur}
							onKeyDown={handleKeyDown}
						/>
					}
					placeholder={
						<div
							className={cn(
								"absolute top-1.5 left-2", // Position like input text
								"text-vscode-input-placeholderForeground",
								"pointer-events-none", // Ignore mouse events
								"select-none", // Prevent selection
								"overflow-hidden",
								"text-ellipsis",
								"whitespace-nowrap", // Prevent wrapping
								"font-vscode-font-family",
								"text-vscode-editor-font-size",
								"leading-vscode-editor-line-height",
								"z-[1]", // Position below content
							)}>
							{placeholder}
						</div>
					}
					ErrorBoundary={LexicalErrorBoundary} // Basic error boundary
				/>
				<HistoryPlugin />
				<AutosizePlugin contentEditableRef={contentEditableRef} onHeightChange={onHeightChange} />
			</div>
		)
	},
)

const LexicalTextAreaComponent = forwardRef<LexicalTextAreaHandle, LexicalTextAreaProps>(
	(props, ref: ForwardedRef<LexicalTextAreaHandle>) => {
		return (
			<LexicalComposer initialConfig={editorConfig}>
				<LexicalTextArea {...props} ref={ref} />
			</LexicalComposer>
		)
	},
)

// Export the component wrapped with LexicalComposer
export default LexicalTextAreaComponent
