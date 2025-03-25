import { memo, useEffect, useRef, useCallback, useState } from "react"
import styled from "styled-components"
import { useCopyToClipboard } from "@src/utils/clipboard"
import { getHighlighter, isLanguageLoaded, normalizeLanguage } from "@src/utils/highlighter"
import { bundledLanguages } from "shiki"
import type { ShikiTransformer } from "shiki"
export const CODE_BLOCK_BG_COLOR = "var(--vscode-editor-background, --vscode-sideBar-background, rgb(30 30 30))"
export const WRAPPER_ALPHA = "cc" // 80% opacity
// Configuration constants
export const WINDOW_SHADE_SETTINGS = {
	transitionDelayS: 0.2,
	collapsedHeight: 500, // Default collapsed height in pixels
}

/*
overflowX: auto + inner div with padding results in an issue where the top/left/bottom padding renders but the right padding inside does not count as overflow as the width of the element is not exceeded. Once the inner div is outside the boundaries of the parent it counts as overflow.
https://stackoverflow.com/questions/60778406/why-is-padding-right-clipped-with-overflowscroll/77292459#77292459
this fixes the issue of right padding clipped off 
“ideal” size in a given axis when given infinite available space--allows the syntax highlighter to grow to largest possible width including its padding
minWidth: "max-content",
*/

interface CodeBlockProps {
	source?: string
	rawSource?: string // Add rawSource prop for copying raw text
	language?: string
	preStyle?: React.CSSProperties
	initialWordWrap?: boolean
	collapsedHeight?: number
	initialWindowShade?: boolean
	onLanguageChange?: (language: string) => void
}

const ButtonIcon = styled.span`
	display: inline-block;
	width: 1.2em;
	text-align: center;
	vertical-align: middle;
`

const CodeBlockButton = styled.button`
	background: transparent;
	border: none;
	color: var(--vscode-foreground);
	cursor: var(--copy-button-cursor, default);
	padding: 4px;
	margin: 0 0px;
	display: flex;
	align-items: center;
	opacity: 0.4;
	border-radius: 3px;
	pointer-events: var(--copy-button-events, none);
	margin-left: 4px;
	height: 24px;

	&:hover {
		background: var(--vscode-toolbar-hoverBackground);
		opacity: 1;
	}
`

const CodeBlockButtonWrapper = styled.div`
	position: fixed;
	top: var(--copy-button-top);
	right: var(--copy-button-right, 8px);
	height: auto;
	z-index: 100;
	background: ${CODE_BLOCK_BG_COLOR}${WRAPPER_ALPHA};
	overflow: visible;
	pointer-events: none;
	opacity: var(--copy-button-opacity, 0);
	padding: 4px 6px;
	border-radius: 3px;
	display: inline-flex;
	align-items: center;
	justify-content: center;

	&:hover {
		background: var(--vscode-editor-background);
		opacity: 1 !important;
	}

	${CodeBlockButton} {
		position: relative;
		top: 0;
		right: 0;
	}
`

const CodeBlockContainer = styled.div`
	position: relative;
	overflow: hidden;
	border-bottom: 4px solid var(--vscode-sideBar-background);
	background-color: ${CODE_BLOCK_BG_COLOR};

	${CodeBlockButtonWrapper} {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s; /* Keep opacity transition for buttons */
	}

	&[data-partially-visible="true"]:hover ${CodeBlockButtonWrapper} {
		opacity: 1;
		pointer-events: all;
		cursor: pointer;
	}
`

export const StyledPre = styled.div<{
	preStyle?: React.CSSProperties
	wordwrap?: "true" | "false" | undefined
	windowshade?: "true" | "false"
	collapsedHeight?: number
}>`
	background-color: ${CODE_BLOCK_BG_COLOR};
	max-height: ${({ windowshade, collapsedHeight }) =>
		windowshade === "true" ? `${collapsedHeight || WINDOW_SHADE_SETTINGS.collapsedHeight}px` : "none"};
	overflow-y: auto;
	padding: 10px;
	// transition: max-height ${WINDOW_SHADE_SETTINGS.transitionDelayS} ease-out;
	border-radius: 5px;
	${({ preStyle }) => preStyle && { ...preStyle }}

	pre {
		background-color: ${CODE_BLOCK_BG_COLOR};
		border-radius: 5px;
		margin: 0;
		padding: 10px;
		width: 100%;
		box-sizing: border-box;
	}

	pre,
	code {
		/* Undefined wordwrap defaults to true (pre-wrap) behavior */
		white-space: ${({ wordwrap }) => (wordwrap === "false" ? "pre" : "pre-wrap")};
		word-break: ${({ wordwrap }) => (wordwrap === "false" ? "normal" : "normal")};
		overflow-wrap: ${({ wordwrap }) => (wordwrap === "false" ? "normal" : "break-word")};
		font-size: var(--vscode-editor-font-size, var(--vscode-font-size, 12px));
		font-family: var(--vscode-editor-font-family);
	}

	pre > code {
		.hljs-deletion {
			background-color: var(--vscode-diffEditor-removedTextBackground);
			display: inline-block;
			width: 100%;
		}
		.hljs-addition {
			background-color: var(--vscode-diffEditor-insertedTextBackground);
			display: inline-block;
			width: 100%;
		}
	}

	.hljs {
		color: var(--vscode-editor-foreground, #fff);
		background-color: ${CODE_BLOCK_BG_COLOR};
	}
`

const LanguageSelect = styled.select`
	font-size: 12px;
	color: var(--vscode-foreground);
	opacity: 0.4;
	font-family: monospace;
	appearance: none;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 4px;
	margin: 0;
	vertical-align: middle;
	height: 24px;

	& option {
		background: var(--vscode-editor-background);
		color: var(--vscode-foreground);
		padding: 0;
		margin: 0;
	}

	&::-webkit-scrollbar {
		width: 6px;
	}

	&::-webkit-scrollbar-thumb {
		background: var(--vscode-scrollbarSlider-background);
	}

	&::-webkit-scrollbar-track {
		background: var(--vscode-editor-background);
	}

	&:hover {
		opacity: 1;
		background: var(--vscode-toolbar-hoverBackground);
		border-radius: 3px;
	}

	&:focus {
		opacity: 1;
		outline: none;
		border-radius: 3px;
	}
`

const CodeBlock = memo(
	({
		source,
		rawSource,
		language,
		preStyle,
		initialWordWrap = true,
		initialWindowShade = true,
		collapsedHeight,
		onLanguageChange,
	}: CodeBlockProps) => {
		const [wordWrap, setWordWrap] = useState(initialWordWrap)
		const [windowShade, setWindowShade] = useState(initialWindowShade)
		const [currentLanguage, setCurrentLanguage] = useState(language)

		const [highlightedCode, setHighlightedCode] = useState<string>("")
		const [showCollapseButton, setShowCollapseButton] = useState(true)
		const codeBlockRef = useRef<HTMLDivElement>(null)
		const preRef = useRef<HTMLDivElement>(null)
		const copyButtonWrapperRef = useRef<HTMLDivElement>(null)
		const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
		language = normalizeLanguage(language)

		// Syntax highlighting with cached Shiki instance
		useEffect(() => {
			const fallback = `<pre style="padding: 0; margin: 0;"><code class="hljs language-${currentLanguage || "txt"}">${source || ""}</code></pre>`
			const highlight = async () => {
				// Show plain text if language needs to be loaded
				if (currentLanguage && !isLanguageLoaded(currentLanguage)) {
					setHighlightedCode(fallback)
				}

				const highlighter = await getHighlighter(currentLanguage)
				const html = await highlighter.codeToHtml(source || "", {
					lang: currentLanguage || "txt",
					theme: document.body.className.toLowerCase().includes("light") ? "github-light" : "github-dark",
					transformers: [
						{
							pre(node) {
								node.properties.style = "padding: 0; margin: 0;"
								return node
							},
							code(node) {
								// Add hljs classes for consistent styling
								node.properties.class = `hljs language-${currentLanguage}`
								return node
							},
							line(node) {
								// Preserve existing line handling
								node.properties.class = node.properties.class || ""
								return node
							},
						},
					] as ShikiTransformer[],
				})
				setHighlightedCode(html)
			}

			highlight().catch((e) => {
				console.error("[CodeBlock] Syntax highlighting error:", e, "\nStack trace:", e.stack)
				setHighlightedCode(fallback)
			})
		}, [source, currentLanguage, collapsedHeight])

		// Check if content height exceeds collapsed height whenever content changes
		useEffect(() => {
			const codeBlock = codeBlockRef.current
			if (codeBlock) {
				const actualHeight = codeBlock.scrollHeight
				setShowCollapseButton(actualHeight >= WINDOW_SHADE_SETTINGS.collapsedHeight)
			}
		}, [highlightedCode])

		// Scroll to bottom immediately when source changes
		useEffect(() => {
			if (preRef.current && source) {
				// Use requestAnimationFrame to ensure DOM is updated
				requestAnimationFrame(() => {
					// Small delay to ensure content is rendered
					setTimeout(() => {
						if (preRef.current) {
							// Use scrollTop for JSDOM compatibility
							preRef.current.scrollTop = preRef.current.scrollHeight
						}
					}, 0)
				})
			}
		}, [source])

		const updateCodeBlockButtonPosition = useCallback((forceShow = false) => {
			const codeBlock = codeBlockRef.current
			const copyWrapper = copyButtonWrapperRef.current
			if (!codeBlock) return

			const rectCodeBlock = codeBlock.getBoundingClientRect()
			const scrollContainer = document.querySelector('[data-virtuoso-scroller="true"]')
			if (!scrollContainer) return

			// Get wrapper height dynamically
			let wrapperHeight
			if (copyWrapper) {
				const copyRect = copyWrapper.getBoundingClientRect()
				// If height is 0 due to styling, estimate from children
				if (copyRect.height > 0) {
					wrapperHeight = copyRect.height
				} else if (copyWrapper.children.length > 0) {
					// Try to get height from the button inside
					const buttonRect = copyWrapper.children[0].getBoundingClientRect()
					const buttonStyle = window.getComputedStyle(copyWrapper.children[0] as Element)
					const buttonPadding =
						parseInt(buttonStyle.getPropertyValue("padding-top") || "0", 10) +
						parseInt(buttonStyle.getPropertyValue("padding-bottom") || "0", 10)
					wrapperHeight = buttonRect.height + buttonPadding
				}
			}

			// If we still don't have a height, calculate from font size
			if (!wrapperHeight) {
				const fontSize = parseInt(window.getComputedStyle(document.body).getPropertyValue("font-size"), 10)
				wrapperHeight = fontSize * 2.5 // Approximate button height based on font size
			}

			const scrollRect = scrollContainer.getBoundingClientRect()
			const copyButtonEdge = 48
			const isPartiallyVisible =
				rectCodeBlock.top < scrollRect.bottom - copyButtonEdge &&
				rectCodeBlock.bottom >= scrollRect.top + copyButtonEdge

			// Calculate margin from existing padding in the component
			const computedStyle = window.getComputedStyle(codeBlock)
			const paddingValue = parseInt(computedStyle.getPropertyValue("padding") || "0", 10)
			const margin =
				paddingValue > 0 ? paddingValue : parseInt(computedStyle.getPropertyValue("padding-top") || "0", 10)

			// Update visibility state and button interactivity
			const isVisible = isPartiallyVisible && (forceShow || isPartiallyVisible)
			codeBlock.setAttribute("data-partially-visible", isPartiallyVisible ? "true" : "false")
			codeBlock.style.setProperty("--copy-button-cursor", isVisible ? "pointer" : "default")
			codeBlock.style.setProperty("--copy-button-events", isVisible ? "all" : "none")
			codeBlock.style.setProperty("--copy-button-opacity", isVisible ? "1" : "0")

			if (isPartiallyVisible) {
				// Keep button within code block bounds using dynamic measurements
				const topPosition = Math.max(
					scrollRect.top + margin,
					Math.min(rectCodeBlock.bottom - wrapperHeight - margin, rectCodeBlock.top + margin),
				)
				const rightPosition = Math.max(margin, scrollRect.right - rectCodeBlock.right + margin)

				codeBlock.style.setProperty("--copy-button-top", `${topPosition}px`)
				codeBlock.style.setProperty("--copy-button-right", `${rightPosition}px`)
			}
		}, [])

		useEffect(() => {
			const handleScroll = () => updateCodeBlockButtonPosition()
			const handleResize = () => updateCodeBlockButtonPosition()

			const scrollContainer = document.querySelector('[data-virtuoso-scroller="true"]')
			if (scrollContainer) {
				scrollContainer.addEventListener("scroll", handleScroll)
				window.addEventListener("resize", handleResize)
				updateCodeBlockButtonPosition()
			}

			return () => {
				if (scrollContainer) {
					scrollContainer.removeEventListener("scroll", handleScroll)
					window.removeEventListener("resize", handleResize)
				}
			}
		}, [updateCodeBlockButtonPosition])

		// Update button position when highlightedCode changes
		useEffect(() => {
			if (highlightedCode) {
				setTimeout(updateCodeBlockButtonPosition, 0)
			}
		}, [highlightedCode, updateCodeBlockButtonPosition])

		const handleCopy = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation()

				// Check if code block is partially visible before allowing copy
				const codeBlock = codeBlockRef.current
				if (!codeBlock || codeBlock.getAttribute("data-partially-visible") !== "true") {
					return
				}
				const textToCopy = rawSource !== undefined ? rawSource : source || ""
				if (textToCopy) {
					copyWithFeedback(textToCopy, e)
				}
			},
			[source, rawSource, copyWithFeedback],
		)

		return (
			<CodeBlockContainer ref={codeBlockRef}>
				<StyledPre
					ref={preRef}
					preStyle={preStyle}
					wordwrap={wordWrap ? "true" : "false"}
					windowshade={windowShade ? "true" : "false"}
					collapsedHeight={collapsedHeight}>
					<div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
				</StyledPre>
				<CodeBlockButtonWrapper
					ref={copyButtonWrapperRef}
					onMouseEnter={() => updateCodeBlockButtonPosition(true)}
					onMouseLeave={() => updateCodeBlockButtonPosition()}
					style={{ gap: 0 }}>
					{language && (
						<LanguageSelect
							value={currentLanguage}
							style={{
								alignContent: "middle",
								width: `${Math.max(3, (currentLanguage?.length || 5) + 1)}ch`,
								textAlign: "right",
								marginRight: 0,
							}}
							onClick={(e) => {
								e.currentTarget.focus()
							}}
							onChange={(e) => {
								const newLang = normalizeLanguage(e.target.value)
								setCurrentLanguage(newLang)
								if (onLanguageChange) {
									onLanguageChange(newLang)
								}
							}}>
							{
								// Display original language at top of list for quick selection
								language && (
									<option
										value={language}
										style={{ fontWeight: "bold", textAlign: "left", fontSize: "1.2em" }}>
										{language}
									</option>
								)
							}
							{
								// Display all available languages in alphabetical order
								Object.keys(bundledLanguages)
									.sort()
									.map((lang) => (
										<option
											key={lang}
											value={lang}
											style={{
												fontWeight: lang === language ? "bold" : "normal",
												textAlign: "left",
												fontSize: lang === language ? "1.2em" : "inherit",
											}}>
											{lang}
										</option>
									))
							}
						</LanguageSelect>
					)}
					{showCollapseButton && (
						<CodeBlockButton
							onClick={() => {
								// Get the current code block element and scrollable container
								const codeBlock = codeBlockRef.current
								const scrollContainer = document.querySelector('[data-virtuoso-scroller="true"]')
								if (!codeBlock || !scrollContainer) return

								// Toggle window shade state
								setWindowShade(!windowShade)

								// After UI updates, ensure code block is visible and update button position
								setTimeout(
									() => {
										codeBlock.scrollIntoView({
											behavior: "smooth",
											block: "nearest",
										})

										// Wait for scroll to complete before updating button position
										setTimeout(() => {
											updateCodeBlockButtonPosition(true)
										}, 50)
									},
									WINDOW_SHADE_SETTINGS.transitionDelayS * 1000 + 50,
								)
							}}
							title={`${windowShade ? "Expand" : "Collapse"} code block`}>
							<ButtonIcon style={{ fontSize: "16px" }}>{windowShade ? "⌄" : "⌃"}</ButtonIcon>
						</CodeBlockButton>
					)}
					<CodeBlockButton
						onClick={() => setWordWrap(!wordWrap)}
						title={`${wordWrap ? "Disable" : "Enable"} word wrap`}>
						<ButtonIcon style={{ fontSize: "16px", fontWeight: 900 }}>{wordWrap ? "⟼" : "⤸"}</ButtonIcon>
					</CodeBlockButton>
					<CodeBlockButton onClick={handleCopy} title="Copy code">
						<ButtonIcon className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`} />
					</CodeBlockButton>
				</CodeBlockButtonWrapper>
			</CodeBlockContainer>
		)
	},
)

export default CodeBlock
