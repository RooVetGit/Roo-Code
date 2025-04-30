import styled from "styled-components"

export const MermaidBlockContainer = styled.div`
	position: relative;
	margin: 8px 0;
`

export const LoadingMessage = styled.div`
	padding: 8px 0;
	color: var(--vscode-descriptionForeground);
	font-style: italic;
	font-size: 0.9em;
`

export const SvgContainer = styled.div<{
	$isLoading: boolean
}>`
	opacity: ${(props) => (props.$isLoading ? 0.3 : 1)};
	min-height: 20px;
	transition: opacity 0.2s ease;
	cursor: pointer;
	display: flex;
	justify-content: center;
`
