import { IconButton } from "./IconButton"

interface ZoomControlsProps {
	zoomLevel: number
	onZoomIn: () => void
	onZoomOut: () => void
	zoomInTitle?: string
	zoomOutTitle?: string
}

export function ZoomControls({ zoomLevel, onZoomIn, onZoomOut, zoomInTitle, zoomOutTitle }: ZoomControlsProps) {
	return (
		<div className="flex items-center gap-2">
			<IconButton icon="zoom-out" onClick={onZoomOut} title={zoomOutTitle} />
			<div className="text-sm text-vscode-editor-foreground min-w-[50px] text-center">
				{Math.round(zoomLevel * 100)}%
			</div>
			<IconButton icon="zoom-in" onClick={onZoomIn} title={zoomInTitle} />
		</div>
	)
}
