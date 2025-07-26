import React, { useState, useRef, useLayoutEffect, memo } from "react"
import { useWindowSize } from "react-use"
import { vscode } from "@src/utils/vscode"
import { getMimeType, isVideoMimeType } from "../../utils/media"
import { FileVideo } from "lucide-react"

interface ThumbnailsProps {
	images: string[]
	style?: React.CSSProperties
	setImages?: React.Dispatch<React.SetStateAction<string[]>>
	onHeightChange?: (height: number) => void
}

const Thumbnails = ({ images, style, setImages, onHeightChange }: ThumbnailsProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
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
	}, [images, width, onHeightChange])

	const handleDelete = (index: number) => {
		setImages?.((prevImages) => prevImages.filter((_, i) => i !== index))
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
			{images.map((image, index) => {
				const mimeType = getMimeType(image)
				const isVideo = isVideoMimeType(mimeType)

				return (
					<div
						key={index}
						style={{ position: "relative" }}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}>
						{isVideo ? (
							<div
								style={{
									width: 34,
									height: 34,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: "var(--vscode-input-background)",
									borderRadius: 4,
									cursor: "pointer",
								}}
								onClick={() => handleImageClick(image)}
								title={`Video: ${mimeType || "Unknown format"}`}>
								<FileVideo size={20} style={{ color: "var(--vscode-descriptionForeground)" }} />
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
								onError={(e) => {
									// Handle image load errors
									const target = e.target as HTMLImageElement
									target.style.display = "none"
									const errorDiv = document.createElement("div")
									errorDiv.style.cssText =
										"width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background-color: var(--vscode-input-background); border-radius: 4px; font-size: 10px; color: var(--vscode-errorForeground);"
									errorDiv.textContent = "!"
									errorDiv.title = "Failed to load image"
									target.parentNode?.appendChild(errorDiv)
								}}
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
				)
			})}
		</div>
	)
}

export default memo(Thumbnails)
