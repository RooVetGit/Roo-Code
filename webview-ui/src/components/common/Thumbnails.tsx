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

	// Sanitize image URL to prevent XSS and malicious redirects
	// Only allow data:image/ URLs since the backend openImage function only supports base64 data URIs
	const sanitizeImageUrl = (url: string): string => {
		try {
			// Only allow data URLs (base64 images) - backend only supports these
			if (url.startsWith("data:image/")) {
				// Additional validation: ensure it's a proper data URI format
				const dataUriRegex = /^data:image\/[a-zA-Z]+;base64,/
				if (dataUriRegex.test(url)) {
					return url
				}
			}

			// Reject all other URLs (http, https, javascript, file, etc.)
			return ""
		} catch {
			// Invalid URL, return empty string
			return ""
		}
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
				const sanitizedUrl = sanitizeImageUrl(image)
				// Skip rendering if URL is invalid/unsafe
				if (!sanitizedUrl) {
					return null
				}

				return (
					<div
						key={index}
						style={{ position: "relative" }}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}>
						<img
							src={sanitizedUrl}
							alt={`Thumbnail ${index + 1}`}
							style={{
								width: 34,
								height: 34,
								objectFit: "cover",
								borderRadius: 4,
								cursor: "pointer",
							}}
							onClick={() => handleImageClick(image)}
						/>
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
