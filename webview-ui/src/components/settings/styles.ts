import styled from "styled-components"

export const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

export const DropdownList = styled.div<{ $zIndex: number }>`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${({ $zIndex }) => $zIndex};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

export const DropdownItem = styled.div<{ $selected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ $selected }) => ($selected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

export const StyledMarkdown = styled.div`
	font-family:
		var(--vscode-font-family),
		system-ui,
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		Roboto,
		Oxygen,
		Ubuntu,
		Cantarell,
		"Open Sans",
		"Helvetica Neue",
		sans-serif;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);

	p,
	li,
	ol,
	ul {
		line-height: 1.25;
		margin: 0;
	}

	ol,
	ul {
		padding-left: 1.5em;
		margin-left: 0;
	}

	p {
		white-space: pre-wrap;
	}

	a {
		text-decoration: none;
	}
	a {
		&:hover {
			text-decoration: underline;
		}
	}
`

// Settings tab styles as CSS class names for use with cn function
export const settingsTabsContainer = "overflow-x-auto" // Changed from overflow-hidden to enable horizontal scrolling

export const settingsTabList = "flex flex-nowrap border-b border-vscode-sideBar-background"

export const settingsTabTrigger =
	"flex-none whitespace-nowrap px-4 py-2 border-b-2 border-transparent text-vscode-foreground opacity-70 transition-all"

export const settingsTabTriggerActive = "opacity-100 border-vscode-focusBorder"

// Utility class to hide scrollbars while maintaining scroll functionality
export const ScrollbarHide = styled.div`
	scrollbar-width: none; /* Firefox */
	-ms-overflow-style: none; /* IE and Edge */
	&::-webkit-scrollbar {
		display: none; /* Chrome, Safari, and Opera */
	}
`

// Tailwind-compatible class names for hiding scrollbars
export const scrollbarHideClasses =
	"scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
