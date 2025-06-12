import { useState, useCallback } from "react"
import { vscode } from "@src/utils/vscode"
import { useCopyToClipboard } from "@src/utils/clipboard"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { MermaidActionButtons } from "./MermaidActionButtons"
import { Modal } from "./Modal"
import { TabButton } from "./TabButton"
import { IconButton } from "./IconButton"
import { ZoomControls } from "./ZoomControls"

export interface MermaidButtonProps {
	containerRef: React.RefObject<HTMLDivElement>
	code: string
	isLoading: boolean
	svgToPng: (svgEl: SVGElement) => Promise<string>
	children: React.ReactNode
}

export function MermaidButton({ containerRef, code, isLoading, svgToPng, children }: MermaidButtonProps) {
	const [showModal, setShowModal] = useState(false)
	const [zoomLevel, setZoomLevel] = useState(1)
	const [copyFeedback, setCopyFeedback] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const [modalViewMode, setModalViewMode] = useState<"diagram" | "code">("diagram")
	const [isDragging, setIsDragging] = useState(false)
	const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
	const { copyWithFeedback } = useCopyToClipboard()
	const { t } = useAppTranslation()

	/**
	 * Opens a modal with the diagram for zooming
	 */
	const handleZoom = async (e: React.MouseEvent) => {
		e.stopPropagation()
		setShowModal(true)
		setZoomLevel(1)
		setModalViewMode("diagram")
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
			console.error("Error copying image:", err instanceof Error ? err.message : String(err))
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
	 * Handle wheel event for zooming with scroll wheel
	 */
	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault()
		e.stopPropagation()

		// Determine zoom direction and amount
		// Negative deltaY means scrolling up (zoom in), positive means scrolling down (zoom out)
		const delta = e.deltaY > 0 ? -0.25 : 0.25
		adjustZoom(delta)
	}, [])

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
			<div className="relative w-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
				{children}
				{!isLoading && isHovering && (
					<div className="absolute bottom-2 right-2 flex gap-1 bg-black/70 rounded p-0.5 z-10 opacity-100 transition-opacity duration-200 ease-in-out">
						<MermaidActionButtons
							onZoom={handleZoom}
							onCopy={handleCopy}
							onViewCode={() => {
								setShowModal(true)
								setModalViewMode("code")
								setZoomLevel(1)
							}}
							copyFeedback={copyFeedback}
						/>
					</div>
				)}
			</div>

			<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
				<div className="flex justify-between items-center border-b border-vscode-editorGroup-border">
					<div className="flex gap-0">
						<TabButton
							icon="graph"
							label={t("common:mermaid.tabs.diagram")}
							isActive={modalViewMode === "diagram"}
							onClick={() => setModalViewMode("diagram")}
						/>
						<TabButton
							icon="code"
							label={t("common:mermaid.tabs.code")}
							isActive={modalViewMode === "code"}
							onClick={() => setModalViewMode("code")}
						/>
					</div>

					<div className="pr-3">
						<IconButton
							icon="close"
							onClick={() => setShowModal(false)}
							title={t("common:mermaid.buttons.close")}
						/>
					</div>
				</div>
				<div
					className="flex-1 p-4 pb-[60px] overflow-auto flex items-center justify-center"
					onWheel={modalViewMode === "diagram" ? handleWheel : undefined}>
					{modalViewMode === "diagram" ? (
						<>
							<div
								style={{
									transform: `scale(${zoomLevel}) translate(${dragPosition.x}px, ${dragPosition.y}px)`,
									transformOrigin: "center center",
									transition: isDragging ? "none" : "transform 0.1s ease",
									cursor: isDragging ? "grabbing" : "grab",
								}}
								onMouseDown={(e) => {
									setIsDragging(true)
									e.preventDefault()
								}}
								onMouseMove={(e) => {
									if (isDragging) {
										setDragPosition((prev) => ({
											x: prev.x + e.movementX / zoomLevel,
											y: prev.y + e.movementY / zoomLevel,
										}))
									}
								}}
								onMouseUp={() => setIsDragging(false)}
								onMouseLeave={() => setIsDragging(false)}>
								{containerRef.current && containerRef.current.innerHTML && (
									<div dangerouslySetInnerHTML={{ __html: containerRef.current.innerHTML }} />
								)}
							</div>
							<div className="absolute bottom-4 left-4 bg-vscode-editor-background border border-vscode-editorGroup-border rounded px-2 py-1 text-xs text-vscode-descriptionForeground pointer-events-none opacity-80">
								{Math.round(zoomLevel * 100)}%
							</div>
						</>
					) : (
						<textarea
							className="w-full min-h-[200px] bg-vscode-editor-background text-vscode-editor-foreground border border-vscode-editorGroup-border rounded-[3px] p-2 font-mono resize-y outline-none"
							readOnly
							value={code}
							style={{ height: "100%", minHeight: "unset", fontSize: "var(--vscode-editor-font-size)" }}
						/>
					)}
				</div>
				<div className="absolute bottom-0 right-0 left-0 p-3 flex items-center justify-end gap-2 bg-vscode-editor-background border-t border-vscode-editorGroup-border rounded-b">
					{modalViewMode === "diagram" ? (
						<>
							<ZoomControls
								zoomLevel={zoomLevel}
								zoomInTitle={t("common:mermaid.buttons.zoomIn")}
								zoomOutTitle={t("common:mermaid.buttons.zoomOut")}
								useContinuousZoom={true}
								adjustZoom={adjustZoom}
								zoomInStep={0.2}
								zoomOutStep={-0.2}
							/>
							<IconButton
								icon={copyFeedback ? "check" : "copy"}
								onClick={handleCopy}
								title={t("common:mermaid.buttons.copy")}
							/>
						</>
					) : (
						<IconButton
							icon={copyFeedback ? "check" : "copy"}
							onClick={(e) => {
								e.stopPropagation()
								copyWithFeedback(code, e)
							}}
							title={t("common:mermaid.buttons.copy")}
						/>
					)}
				</div>
			</Modal>
		</>
	)
}
