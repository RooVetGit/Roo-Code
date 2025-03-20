import { memo, useEffect, useRef, useCallback, useState } from "react"
import debounce from "debounce"
import { createHighlighter } from "shiki"
import styled from "styled-components"
import { useCopyToClipboard } from "@src/utils/clipboard"
export const CODE_BLOCK_BG_COLOR = "var(--vscode-editor-background, --vscode-sideBar-background, rgb(30 30 30))"

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
}

const CopyButton = styled.button`
	background: transparent;
	border: none;
	color: var(--vscode-foreground);
	cursor: var(--copy-button-cursor, default);
	padding: 4px;
	display: flex;
	align-items: center;
	opacity: 0.4;
	border-radius: 3px;
	pointer-events: var(--copy-button-events, none);

	&:hover {
		background: var(--vscode-toolbar-hoverBackground);
		opacity: 1;
	}
`

const CopyButtonWrapper = styled.div`
	position: fixed;
	top: var(--copy-button-top);
	right: var(--copy-button-right, 8px);
	height: 0;
	z-index: 100;
	background: ${CODE_BLOCK_BG_COLOR};
	overflow: visible;
	pointer-events: none;
	opacity: var(--copy-button-opacity, 0);
	padding: 4px;
	border-radius: 3px;

	&:hover {
		background: var(--vscode-editor-background);
	}

	${CopyButton} {
		position: relative;
		top: 0;
		right: 0;
	}
`

const CodeBlockContainer = styled.div`
	position: relative;
	overflow: hidden;
	background-color: ${CODE_BLOCK_BG_COLOR};

	&[data-partially-visible="true"]:hover ${CopyButtonWrapper} {
		opacity: 1 !important;
	}
`

export const StyledPre = styled.div<{ preStyle?: React.CSSProperties; wordwrap?: boolean }>`
	background-color: ${CODE_BLOCK_BG_COLOR};
	padding: 10px;
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
		white-space: ${({ wordwrap }) => (wordwrap === false ? "pre" : "pre-wrap")};
		word-break: ${({ wordwrap }) => (wordwrap === false ? "normal" : "normal")};
		overflow-wrap: ${({ wordwrap }) => (wordwrap === false ? "normal" : "break-word")};
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

const CodeBlock = memo(({ source, rawSource, language, preStyle }: CodeBlockProps) => {
	const [highlightedCode, setHighlightedCode] = useState<string>("")
	const codeBlockRef = useRef<HTMLDivElement>(null)
	const copyButtonWrapperRef = useRef<HTMLDivElement>(null)
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()

	// Direct syntax highlighting with Shiki
	useEffect(() => {
		const highlight = async () => {
			try {
				const highlighter = await createHighlighter({
					themes: ["github-dark", "github-light"],
					langs: [language || "txt"],
				})
				const html = await highlighter.codeToHtml(source || "", {
					lang: language || "txt",
					theme: document.body.className.toLowerCase().includes("light") ? "github-light" : "github-dark",
					transformers: [
						{
							pre(node: any) {
								node.properties.style = "padding: 0; margin: 0;"
								return node
							},
							code(node: any) {
								// Add hljs classes for consistent styling
								node.properties.class = `hljs language-${language || "txt"}`
								return node
							},
							line(node: any) {
								// Preserve existing line handling
								node.properties.class = node.properties.class || ""
								return node
							},
						},
					],
				})
				setHighlightedCode(html)
			} catch (e: any) {
				console.error("CodeBlock highlighting error:", e, "\nStack trace:", e.stack)
				setHighlightedCode(source || "")
			}
		}
		highlight()
	}, [source, language])

	const updateCopyButtonPosition = useCallback((forceShow = false) => {
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
		const debouncedUpdate = debounce(updateCopyButtonPosition, 10)
		const handleScroll = () => debouncedUpdate()
		const handleResize = () => debouncedUpdate()

		const scrollContainer = document.querySelector('[data-virtuoso-scroller="true"]')
		if (scrollContainer) {
			scrollContainer.addEventListener("scroll", handleScroll)
			window.addEventListener("resize", handleResize)
			updateCopyButtonPosition()
		}

		return () => {
			if (scrollContainer) {
				scrollContainer.removeEventListener("scroll", handleScroll)
				window.removeEventListener("resize", handleResize)
			}
			debouncedUpdate.clear()
		}
	}, [updateCopyButtonPosition])

	// Update button position when highlightedCode changes
	useEffect(() => {
		if (highlightedCode) {
			setTimeout(updateCopyButtonPosition, 0)
		}
	}, [highlightedCode, updateCopyButtonPosition])

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
			<StyledPre preStyle={preStyle} wordwrap={true}>
				<div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
			</StyledPre>
			<CopyButtonWrapper
				ref={copyButtonWrapperRef}
				onMouseEnter={() => updateCopyButtonPosition(true)}
				onMouseLeave={() => updateCopyButtonPosition()}>
				<CopyButton onClick={handleCopy} title="Copy code">
					<span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`} />
				</CopyButton>
			</CopyButtonWrapper>
		</CodeBlockContainer>
	)
})

export default CodeBlock
