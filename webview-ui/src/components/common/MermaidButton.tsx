import { useState } from "react"
import styled from "styled-components"
import { vscode } from "@src/utils/vscode"
import { useCopyToClipboard } from "@src/utils/clipboard"

export interface WeCodeMermaidButtonProps {
	containerRef: React.RefObject<HTMLDivElement>
	code: string
	isLoading: boolean
	svgToPng: (svgEl: SVGElement) => Promise<string>
	children: React.ReactNode
}

export function MermaidButton({ containerRef, code, isLoading, svgToPng, children }: WeCodeMermaidButtonProps) {
	const [showModal, setShowModal] = useState(false)
	const [showCodeModal, setShowCodeModal] = useState(false)
	const [zoomLevel, setZoomLevel] = useState(1)
	const [copyFeedback, setCopyFeedback] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	/**
	 * Opens a modal with the diagram for zooming
	 */
	const handleZoom = async (e: React.MouseEvent) => {
		e.stopPropagation()
		setShowModal(true)
		setZoomLevel(1)
	}

	/**
	 * Copies the diagram as PNG to clipboard
	 */
	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation()
		if (!containerRef.current) return
		const svgEl = containerRef.current.querySelector("svg")
		if (!svgEl) return

		try {
			const pngDataUrl = await svgToPng(svgEl)

			// Send the image to the extension to handle copying
			// Reuse the openImage message type with an additional parameter
			vscode.postMessage({
				type: "openImage",
				text: pngDataUrl,
				values: { action: "copy" }, // Add this parameter to indicate copy action
			})

			// Show feedback
			setCopyFeedback(true)
			setTimeout(() => setCopyFeedback(false), 2000)
		} catch (err) {
			console.error("Error copying image:", err)
		}
	}

	/**
	 * Adjust zoom level in the modal
	 */
	const adjustZoom = (amount: number) => {
		setZoomLevel((prev) => {
			const newZoom = prev + amount
			return Math.max(0.5, Math.min(3, newZoom))
		})
	}

	/**
	 * Handle mouse enter event for diagram container
	 */
	const handleMouseEnter = () => {
		setIsHovering(true)
	}

	/**
	 * Handle mouse leave event for diagram container
	 */
	const handleMouseLeave = () => {
		setIsHovering(false)
	}

	return (
		<>
			<DiagramContainer onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
				{children}
				{!isLoading && isHovering && (
					<ActionButtons>
						<ActionButton onClick={handleZoom} title={"Zoom"}>
							<span className="codicon codicon-zoom-in"></span>
						</ActionButton>
						<ActionButton onClick={handleCopy} title={"Copy"}>
							<span className={`codicon codicon-${copyFeedback ? "check" : "copy"}`}></span>
						</ActionButton>
						<ActionButton
							onClick={(e) => {
								e.stopPropagation()
								setShowCodeModal(true)
							}}
							title={"show mermaid code"}>
							<span className="codicon codicon-code"></span>
						</ActionButton>
					</ActionButtons>
				)}
			</DiagramContainer>

			{showModal && (
				<Modal onClick={() => setShowModal(false)}>
					<ModalContent onClick={(e) => e.stopPropagation()}>
						<ModalHeader>
							<ZoomControls>
								<ActionButton onClick={() => adjustZoom(-0.1)} title={"Zoom Out"}>
									<span className="codicon codicon-zoom-out"></span>
								</ActionButton>
								<ZoomLevel>{Math.round(zoomLevel * 100)}%</ZoomLevel>
								<ActionButton onClick={() => adjustZoom(0.1)} title={"Zoom In"}>
									<span className="codicon codicon-zoom-in"></span>
								</ActionButton>
								<ActionButton onClick={handleCopy} title={"Copy"}>
									<span className={`codicon codicon-${copyFeedback ? "check" : "copy"}`}></span>
								</ActionButton>
								<ActionButton
									onClick={(e) => {
										e.stopPropagation()
										setShowCodeModal(true)
									}}
									title={"show mermaid code"}>
									<span className="codicon codicon-code"></span>
								</ActionButton>
							</ZoomControls>

							<ActionButton onClick={() => setShowModal(false)} title={"Close"}>
								<span className="codicon codicon-close"></span>
							</ActionButton>
						</ModalHeader>
						<ModalBody>
							<div
								style={{
									transform: `scale(${zoomLevel})`,
									transformOrigin: "top center",
									transition: "transform 0.2s ease",
								}}>
								{containerRef.current && containerRef.current.innerHTML && (
									<div dangerouslySetInnerHTML={{ __html: containerRef.current.innerHTML }} />
								)}
							</div>
						</ModalBody>
					</ModalContent>
				</Modal>
			)}

			{showCodeModal && (
				<Modal onClick={() => setShowCodeModal(false)}>
					<CodeModalContent onClick={(e) => e.stopPropagation()}>
						<ModalHeader>
							<div>Mermaid Code</div>
							<div style={{ display: "flex", gap: "4px" }}>
								<ActionButton
									onClick={(e) => {
										e.stopPropagation()
										copyWithFeedback(code, e)
									}}
									title={"Copy"}>
									<span className={`codicon codicon-${copyFeedback ? "check" : "copy"}`}></span>
								</ActionButton>
								<ActionButton onClick={() => setShowCodeModal(false)} title={"Close"}>
									<span className="codicon codicon-close"></span>
								</ActionButton>
							</div>
						</ModalHeader>
						<CodeModalBody>
							<CodeTextArea readOnly value={code} />
						</CodeModalBody>
					</CodeModalContent>
				</Modal>
			)}
		</>
	)
}

export const DiagramContainer = styled.div`
	position: relative;
	width: 100%;
`

export const ActionButtons = styled.div`
	position: absolute;
	bottom: 8px;
	right: 8px;
	display: flex;
	gap: 4px;
	background-color: rgba(30, 30, 30, 0.7);
	border-radius: 4px;
	padding: 2px;
	z-index: 10;
	opacity: 1;
	transition: opacity 0.2s ease;
`

export const ActionButton = styled.button`
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	color: var(--vscode-editor-foreground);
	cursor: pointer;
	border-radius: 3px;

	&:hover {
		background-color: var(--vscode-toolbar-hoverBackground);
	}
`

export const Modal = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
`

export const ModalContent = styled.div`
	background-color: var(--vscode-editor-background);
	border-radius: 4px;
	width: 90%;
	height: 90%;
	max-width: 1200px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
	border: 1px solid var(--vscode-editorGroup-border);
`

export const ModalHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	border-bottom: 1px solid var(--vscode-editorGroup-border);
`

export const CodeModalContent = styled.div`
	background-color: var(--vscode-editor-background);
	border-radius: 4px;
	width: 90%;
	max-width: 800px;
	max-height: 90%;
	display: flex;
	flex-direction: column;
	box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
	border: 1px solid var(--vscode-editorGroup-border);
`

export const CodeModalBody = styled.div`
	padding: 16px;
	overflow: auto;
	max-height: 60vh;
`

export const CodeTextArea = styled.textarea`
	width: 100%;
	min-height: 200px;
	background-color: var(--vscode-editor-background);
	color: var(--vscode-editor-foreground);
	border: 1px solid var(--vscode-editorGroup-border);
	border-radius: 3px;
	padding: 8px;
	font-family: var(--vscode-editor-font-family, monospace);
	font-size: var(--vscode-editor-font-size);
	resize: vertical;
	outline: none;
`

export const ModalBody = styled.div`
	flex: 1;
	padding: 16px;
	overflow: auto;
	display: flex;
	align-items: flex-start;
	justify-content: center;
`

export const ZoomControls = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`

export const ZoomLevel = styled.div`
	font-size: 14px;
	color: var(--vscode-editor-foreground);
	min-width: 50px;
	text-align: center;
`
