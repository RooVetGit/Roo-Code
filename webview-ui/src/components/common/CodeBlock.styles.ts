import styled from "styled-components"

export const CODE_BLOCK_BG_COLOR = "var(--vscode-editor-background, --vscode-sideBar-background, rgb(30 30 30))"

const WRAPPER_ALPHA = "cc"

export const ButtonIcon = styled.span`
	display: inline-block;
	width: 1.2em;
	text-align: center;
	vertical-align: middle;
`

export const CodeBlockButton = styled.button`
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

export const CodeBlockButtonWrapper = styled.div`
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

export const CodeBlockContainer = styled.div`
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
	max-height: ${({ windowshade, collapsedHeight = 500 }) =>
		windowshade === "true" ? `${collapsedHeight}px` : "none"};
	overflow-y: auto;
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

export const LanguageSelect = styled.select`
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
