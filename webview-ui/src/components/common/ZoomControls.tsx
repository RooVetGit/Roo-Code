import { IconButton } from "./IconButton"
import { useRef, useEffect } from "react"

interface ZoomControlsProps {
	zoomLevel: number
	zoomInTitle?: string
	zoomOutTitle?: string
	useContinuousZoom?: boolean
	adjustZoom?: (amount: number) => void
	zoomInStep?: number
	zoomOutStep?: number
	onZoomIn?: () => void
	onZoomOut?: () => void
}

export function ZoomControls({
	zoomLevel,
	zoomInTitle,
	zoomOutTitle,
	useContinuousZoom = false,
	adjustZoom,
	zoomInStep = 0.1,
	zoomOutStep = -0.1,
	onZoomIn,
	onZoomOut,
}: ZoomControlsProps) {
	const zoomIntervalRef = useRef<NodeJS.Timeout | null>(null)

	/**
	 * Start continuous zoom on mouse down
	 */
	const startContinuousZoom = (amount: number) => {
		if (!useContinuousZoom || !adjustZoom) return

		// Clear any existing interval first
		if (zoomIntervalRef.current) {
			clearInterval(zoomIntervalRef.current)
		}

		// Immediately apply first zoom adjustment
		adjustZoom(amount)

		// Set up interval for continuous zooming
		zoomIntervalRef.current = setInterval(() => {
			adjustZoom(amount)
		}, 150) // Adjust every 150ms while button is held down
	}

	/**
	 * Stop continuous zoom on mouse up or mouse leave
	 */
	const stopContinuousZoom = () => {
		if (zoomIntervalRef.current) {
			clearInterval(zoomIntervalRef.current)
			zoomIntervalRef.current = null
		}
	}

	// Clean up interval on unmount
	useEffect(() => {
		return () => {
			if (zoomIntervalRef.current) {
				clearInterval(zoomIntervalRef.current)
			}
		}
	}, [])

	// If using continuous zoom, render buttons with mouse down/up handlers
	if (useContinuousZoom && adjustZoom) {
		return (
			<div className="flex items-center gap-2">
				<button
					className="w-7 h-7 flex items-center justify-center border-none text-vscode-editor-foreground cursor-pointer rounded-[3px] bg-transparent hover:bg-vscode-toolbar-hoverBackground"
					onMouseDown={() => startContinuousZoom(zoomOutStep)}
					onMouseUp={stopContinuousZoom}
					onMouseLeave={stopContinuousZoom}
					title={zoomOutTitle}>
					<span className="codicon codicon-zoom-out"></span>
				</button>
				<div className="text-sm text-vscode-editor-foreground min-w-[50px] text-center">
					{Math.round(zoomLevel * 100)}%
				</div>
				<button
					className="w-7 h-7 flex items-center justify-center border-none text-vscode-editor-foreground cursor-pointer rounded-[3px] bg-transparent hover:bg-vscode-toolbar-hoverBackground"
					onMouseDown={() => startContinuousZoom(zoomInStep)}
					onMouseUp={stopContinuousZoom}
					onMouseLeave={stopContinuousZoom}
					title={zoomInTitle}>
					<span className="codicon codicon-zoom-in"></span>
				</button>
			</div>
		)
	}

	// Default rendering with simple click handlers
	return (
		<div className="flex items-center gap-2">
			<IconButton icon="zoom-out" onClick={onZoomOut || (() => adjustZoom?.(zoomOutStep))} title={zoomOutTitle} />
			<div className="text-sm text-vscode-editor-foreground min-w-[50px] text-center">
				{Math.round(zoomLevel * 100)}%
			</div>
			<IconButton icon="zoom-in" onClick={onZoomIn || (() => adjustZoom?.(zoomInStep))} title={zoomInTitle} />
		</div>
	)
}
