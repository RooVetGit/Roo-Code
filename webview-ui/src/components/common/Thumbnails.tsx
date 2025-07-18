import React, { useState, useRef, useLayoutEffect, memo } from "react"
import { useWindowSize } from "react-use"
import { vscode } from "@src/utils/vscode"

interface ThumbnailsProps {
	images: string[]
	style?: React.CSSProperties
	setImages?: React.Dispatch<React.SetStateAction<string[]>>
	onHeightChange?: (height: number) => void
}

const Thumbnails = ({ images, style, setImages, onHeightChange }: ThumbnailsProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const [failedImages, setFailedImages] = useState<Set<number>>(new Set())
	const containerRef = useRef<HTMLDivElement>(null)
	const { width } = useWindowSize()

	useLayoutEffect(() => {
		if (containerRef.current) {
			let height = containerRef.current.clientHeight
			// some browsers return 0 for clientHeight
			if (!height) {
				height = containerRef.current.getBoundingClientRect().height
			}
			onHeightChange?.(height)
		}
		setHoveredIndex(null)
		// Reset failed images when images change
		setFailedImages(new Set())
	}, [images, width, onHeightChange])

	const handleDelete = (index: number) => {
		setImages?.((prevImages) => prevImages.filter((_, i) => i !== index))
	}

	const handleImageError = (index: number) => {
		setFailedImages((prev) => new Set(prev).add(index))
		console.warn(`Failed to load image at index ${index}`)
	}

	const isDeletable = setImages !== undefined

	const handleImageClick = (image: string) => {
		vscode.postMessage({ type: "openImage", text: image })
	}

	return (
		<div
			ref={containerRef}
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 5,
				rowGap: 3,
				...style,
			}}>
			{images.map((image, index) => (
				<div
					key={index}
					style={{ position: "relative" }}
					onMouseEnter={() => setHoveredIndex(index)}
					onMouseLeave={() => setHoveredIndex(null)}>
					{failedImages.has(index) ? (
						<div
							style={{
								width: 34,
								height: 34,
								borderRadius: 4,
								backgroundColor: "var(--vscode-input-background)",
								border: "1px solid var(--vscode-input-border)",
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								cursor: "pointer",
							}}
							onClick={() => handleImageClick(image)}
							title="Failed to load image">
							<span
								className="codicon codicon-file-media"
								style={{
									color: "var(--vscode-descriptionForeground)",
									fontSize: 16,
								}}></span>
						</div>
					) : (
						<img
							src={image}
							alt={`Thumbnail ${index + 1}`}
							style={{
								width: 34,
								height: 34,
								objectFit: "cover",
								borderRadius: 4,
								cursor: "pointer",
							}}
							onClick={() => handleImageClick(image)}
							onError={() => handleImageError(index)}
						/>
					)}
					{isDeletable && hoveredIndex === index && (
						<div
							onClick={() => handleDelete(index)}
							style={{
								position: "absolute",
								top: -4,
								right: -4,
								width: 13,
								height: 13,
								borderRadius: "50%",
								backgroundColor: "var(--vscode-badge-background)",
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								cursor: "pointer",
							}}>
							<span
								className="codicon codicon-close"
								style={{
									color: "var(--vscode-foreground)",
									fontSize: 10,
									fontWeight: "bold",
								}}></span>
						</div>
					)}
				</div>
			))}
		</div>
	)
}

export default memo(Thumbnails)
