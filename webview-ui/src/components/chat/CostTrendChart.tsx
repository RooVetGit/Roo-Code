import React, { useRef, useEffect, useMemo, useState } from "react"
import uPlot, { type Options, type AlignedData } from "uplot"
import "uplot/dist/uPlot.min.css"
import { formatLargeNumber } from "@src/utils/format" // Import the formatter

// Create a shared sync instance for all charts
// This needs to be outside the component to be shared across all instances
const GRID_SYNC = uPlot.sync("cost-charts-grid")

// Data is now expected as pre-processed [xValues, yValues]
type ChartData = AlignedData | undefined // uPlot.AlignedData is typically [number[], number[], ...]

interface CostTrendChartProps {
	chartData: ChartData // Renamed from 'data' and changed type
	onHoverChange: (hoverData: { isHovering: boolean; index?: number; yValue?: number } | null) => void // Changed 'cost' to 'yValue'
	onClick?: (event: MouseEvent) => void // Re-add onClick prop definition
	yAxisUnit?: string
	chartLabel?: string // Optional label for the series
	height?: number // Optional height override
	showXAxis?: boolean // Prop to control X-axis visibility (re-added)
	showYAxis?: boolean // Prop to control Y-axis visibility
	yAxisSide?: "left" | "right" // Prop to control Y-axis side
	axisFontSize?: string // Optional prop for axis font size
	syncKey?: string // Optional key for cursor synchronization
	hideYAxisZero?: boolean // Optional: Hide the zero value on the Y axis
	showGridLines?: boolean // Optional: Control visibility of grid lines
	padding?: [number, number, number, number] // Optional: Custom padding [top, right, bottom, left]
}

const getResolvedStyle = (variableName: string, fallback: string): string => {
	if (typeof window !== "undefined") {
		return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback
	}
	return fallback
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({
	chartData, // Use renamed prop
	onHoverChange,
	onClick, // Re-add onClick prop destructuring
	yAxisUnit = "$",
	chartLabel = "Value", // Default label
	height = 180, // Default height
	showXAxis = true, // Default to true (re-added)
	showYAxis = true, // Default to true
	yAxisSide = "left", // Default to LEFT now
	axisFontSize,
	syncKey, // Add the new prop
	hideYAxisZero = false, // Default to false
	showGridLines = true, // Default to true
	padding = [10, 0, 0, 0], // Default padding
}) => {
	const chartRef = useRef<HTMLDivElement>(null)
	const uplotInstanceRef = useRef<uPlot | null>(null)
	// Removed isClickInProgressRef

	const [resolvedStyles, setResolvedStyles] = useState({
		foreground: "#cccccc",
		buttonForeground: "#ffffff",
		editorBackground: "#1e1e1e",
		tabsBorder: "#555555",
		selectionBackground: "rgba(255, 255, 255, 0.2)",
		widgetBackground: "#252526",
		widgetBorder: "#454545",
		descriptionForeground: "#8b949e",
		fontSize: "13px",
		fontFamily: "sans-serif",
	})

	// Effect to read styles on mount and update on theme change
	useEffect(() => {
		const updateStyles = () => {
			setResolvedStyles({
				foreground: getResolvedStyle("--vscode-foreground", "#cccccc"),
				buttonForeground: getResolvedStyle("--vscode-button-foreground", "#ffffff"),
				editorBackground: getResolvedStyle("--vscode-editor-background", "#1e1e1e"),
				tabsBorder: getResolvedStyle("--vscode-editorGroupHeader-tabsBorder", "#555555"),
				selectionBackground: getResolvedStyle(
					"--vscode-editor-selectionBackground",
					"rgba(255, 255, 255, 0.2)",
				),
				widgetBackground: getResolvedStyle("--vscode-editorWidget-background", "#252526"),
				widgetBorder: getResolvedStyle("--vscode-editorWidget-border", "#454545"),
				descriptionForeground: getResolvedStyle("--vscode-descriptionForeground", "#8b949e"),
				fontSize: getResolvedStyle("--vscode-font-size", "13px"),
				fontFamily: getResolvedStyle("--vscode-font-family", "sans-serif"),
			})
		}

		updateStyles() // Initial style fetch

		// Observe theme changes
		const observer = new MutationObserver((mutationsList) => {
			for (const mutation of mutationsList) {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					updateStyles()
					break
				}
			}
		})

		observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

		// Cleanup observer on component unmount
		return () => observer.disconnect()
	}, [])

	const options = useMemo((): Options => {
		// Define the click plugin here to close over the onClick prop
		const clickPlugin = {
			hooks: {
				init: (u: uPlot) => {
					// Only add listener if onClick is provided
					if (onClick) {
						const overElement = u.over
						const handleCaptureClick = (e: MouseEvent) => {
							if (e.detail === 1) {
								// Only single clicks
								// Use stopImmediatePropagation to block ALL other click listeners on this element
								e.stopImmediatePropagation()
								onClick(e) // Call the passed React handler
							}
						}
						// Add listener in capture phase
						overElement.addEventListener("click", handleCaptureClick, { capture: true })

						// Add cleanup for this specific listener to the destroy hook
						// This ensures the listener is removed when the uPlot instance is destroyed
						// Note: This might add multiple destroy hooks if options recompute often,
						// but uPlot handles multiple hooks fine. A more complex ref-based approach
						// could avoid this but adds complexity.
						u.hooks.destroy?.push(() => {
							overElement.removeEventListener("click", handleCaptureClick, { capture: true })
						})
					}
				},
			},
		}

		const matchSyncKeys = (ownScaleKey: string | null, extScaleKey: string | null) => ownScaleKey === extScaleKey
		const numberOfPoints = chartData?.[0]?.length ?? 0
		const showPointsOnly = numberOfPoints === 1
		const pointSize = 6 / (window.devicePixelRatio || 1)
		const effectiveHeight = height ?? 180

		// Define the type for padding explicitly
		type PaddingTuple = [number, number, number, number]

		// Create dynamic padding based on y-axis position
		const dynamicPadding: PaddingTuple =
			yAxisSide === "right"
				? [padding[0], 0, padding[2], padding[3]] // Revert to 0 right padding
				: padding // Use default padding (already a PaddingTuple)

		return {
			width: 400,
			height: effectiveHeight,
			padding: dynamicPadding,
			series: [
				{},
				{
					label: chartLabel,
					stroke: resolvedStyles.buttonForeground,
					width: showPointsOnly ? 0 : 2 / (window.devicePixelRatio || 1), // Halved stroke width
					points: {
						show: showPointsOnly,
						size: pointSize,
						fill: resolvedStyles.buttonForeground,
						stroke: resolvedStyles.buttonForeground,
					},
					scale: "$",
				},
			],
			axes: [
				{
					show: showXAxis,
					stroke: showXAxis ? resolvedStyles.foreground : "transparent",
					grid: {
						show: showXAxis && showGridLines,
						stroke: resolvedStyles.tabsBorder,
						width: 1 / (window.devicePixelRatio || 1),
					},
					ticks: {
						show: showXAxis,
						stroke: resolvedStyles.widgetBorder,
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					font: `${axisFontSize || resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`,
					size: showXAxis ? 30 : 0,
					incrs: [1, 2, 5, 10, 20, 50, 100],
					space: 30,
					values: showXAxis
						? (u: uPlot, ticks: number[]) => {
								return ticks.map((rawValue: number) => {
									const roundedValue = Math.round(rawValue)
									return roundedValue === 0 ? "" : roundedValue.toString()
								})
							}
						: undefined,
				},
				{
					show: showYAxis,
					scale: "$",
					side: yAxisSide === "left" ? 3 : 1,
					stroke: showYAxis ? resolvedStyles.foreground : "transparent",
					grid: {
						show: showGridLines,
						stroke: resolvedStyles.tabsBorder,
						width: 1 / (window.devicePixelRatio || 1),
					},
					ticks: {
						show: showYAxis,
						stroke: resolvedStyles.widgetBorder,
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					font: `${axisFontSize || resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`,
					incrs: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
					space: showYAxis ? 30 : 0,
					// Remove the align property as it's causing TypeScript errors
					values: showYAxis
						? (u: uPlot, ticks: number[]) =>
								ticks.map((rawValue: number) => {
									if (hideYAxisZero && rawValue === 0) {
										return ""
									}
									if (yAxisUnit === "$") {
										// Keep currency formatting for cost
										return `${yAxisUnit}${rawValue.toFixed(2)}`
									} else {
										// Use formatLargeNumber for other units (tokens, etc.)
										return formatLargeNumber(rawValue)
									}
								})
						: undefined,
					size: showYAxis ? (yAxisSide === "right" ? 50 : 65) : 0, // Revert to fixed size (50px) for right axis
				},
			],
			scales: {
				x: {
					time: false,
					auto: true,
				},
				$: {
					auto: true,
					range: [0, null],
				},
			},
			cursor: {
				lock: false, // Disable cursor locking on click
				drag: { x: false, y: false, setScale: false },
				points: {
					show: true,
					size: 6 / (window.devicePixelRatio || 1),
					stroke: resolvedStyles.buttonForeground,
					fill: resolvedStyles.editorBackground,
				},
				focus: {
					prox: 30,
				},
				sync: {
					key: syncKey === "grid" ? GRID_SYNC.key : syncKey || "no-sync",
					setSeries: true,
					match: [matchSyncKeys, matchSyncKeys],
				},
			},
			legend: {
				show: false,
			},
			// Add the plugin to the options
			plugins: [clickPlugin],
			hooks: {
				// Keep existing hooks
				setCursor: [
					(u: uPlot) => {
						// Restore original setCursor logic
						const { idx } = u.cursor
						if (idx != null) {
							const requestIndex = u.data[0]?.[idx]
							const yValue = u.data[1]?.[idx]
							if (typeof requestIndex === "number" && typeof yValue === "number") {
								onHoverChange({ isHovering: true, index: requestIndex, yValue: yValue })
							} else {
								onHoverChange({ isHovering: false })
							}
						}
						// Parent component handles mouse leave to clear hover state
					},
				],
				draw: [
					(u: uPlot) => {
						if (!showGridLines) {
							const ctx = u.ctx
							const { left, top, width, height } = u.bbox
							ctx.save()
							ctx.strokeStyle = resolvedStyles.widgetBorder
							ctx.lineWidth = 1 / (window.devicePixelRatio || 1)
							ctx.strokeRect(left, top, width, height)
							ctx.restore()
						}
					},
				],
			},
		}
		// Update dependencies: Add onClick as it's now used in the plugin definition within useMemo
	}, [
		resolvedStyles,
		onHoverChange,
		onClick, // Add onClick dependency
		chartData,
		yAxisUnit,
		chartLabel,
		height,
		showXAxis,
		showYAxis,
		yAxisSide,
		axisFontSize,
		syncKey,
		hideYAxisZero,
		showGridLines,
		padding,
	])

	useEffect(() => {
		// Remove all the previous manual event listener logic.
		// The plugin now handles the click interception.

		// Check chartData instead of uplotData
		if (chartRef.current && chartData && chartData[0] && chartData[0].length > 0) {
			uplotInstanceRef.current?.destroy() // Destroy previous instance if exists

			try {
				// Pass chartData directly
				// The options object now includes the clickPlugin
				const uplotInstance = new uPlot(options, chartData, chartRef.current)
				uplotInstanceRef.current = uplotInstance

				// No need to manually attach listeners here anymore
				// overElement = uplotInstance.over;
				// ... removed listener attachment logic ...
			} catch (error) {
				console.error("Error creating uPlot instance:", error)
			}

			const handleResize = () => {
				if (chartRef.current && uplotInstanceRef.current) {
					uplotInstanceRef.current.setSize({
						width: chartRef.current.offsetWidth,
						height: options.height!,
					})
				}
			}

			handleResize()
			window.addEventListener("resize", handleResize)

			return () => {
				window.removeEventListener("resize", handleResize)
				// The plugin's destroy hook handles listener cleanup now.
				// We just need to destroy the uPlot instance itself.
				uplotInstanceRef.current?.destroy()
				uplotInstanceRef.current = null // Clear ref on cleanup
			}
		} else if (uplotInstanceRef.current) {
			// If data becomes empty/invalid, destroy the existing chart
			uplotInstanceRef.current.destroy()
			uplotInstanceRef.current = null
		}
		// Re-add onClick to dependency array
	}, [options, chartData, onClick])

	useEffect(() => {
		const styleId = "uplot-custom-styles"
		document.getElementById(styleId)?.remove()

		// Check chartData instead of uplotData
		if (chartData && chartData[0] && chartData[0].length > 0) {
			const styleEl = document.createElement("style")
			styleEl.id = styleId
			styleEl.innerHTML = `
			     .u-legend {
			       color: ${resolvedStyles.foreground} !important;
			       background: ${resolvedStyles.editorBackground} !important;
			       margin-bottom: 5px !important;
			     }
			     .u-legend th, .u-legend td {
			       color: ${resolvedStyles.foreground} !important;
			       padding: 2px 5px !important;
			     }
			     .u-select {
			       background: ${resolvedStyles.selectionBackground} !important;
			     }
			     .u-tooltip {
			       background: ${resolvedStyles.widgetBackground} !important;
			       border: 1px solid ${resolvedStyles.widgetBorder} !important;
			       color: ${resolvedStyles.foreground} !important;
			       padding: 4px 8px !important;
			       border-radius: 3px !important;
			       font-size: 12px !important;
			       font-family: var(--vscode-font-family) !important;
			       z-index: 10 !important;
			     }
			     .u-over {
			       /* Prevent the uPlot overlay from intercepting clicks meant for the parent */
			     }
			     .u-legend .u-marker {
			       border-color: ${resolvedStyles.buttonForeground} !important;
			     }
			     /* Right-align y-axis values when axis is on the right side */
			     .u-axis.u-right .u-label,
			     .u-axis.u-right .u-value,
			     .u-axis[data-side="1"] .u-label,
			     .u-axis[data-side="1"] .u-value,
			     .u-axis[data-side="1"] text {
			       text-align: right !important;
			     }
			     
			     /* Style for right-side y-axis - allow natural positioning */
			     .u-axis[data-side="1"] {
			       /* Let uPlot handle positioning naturally */
			     }
	     `
			document.head.appendChild(styleEl)
		}
		// Update dependencies: use chartData instead of uplotData
	}, [resolvedStyles, chartData])

	// Check chartData instead of uplotData
	if (!chartData || !chartData[0] || chartData[0].length === 0) {
		return (
			<div
				className="text-xs p-2 flex items-center justify-center"
				style={{
					// Use effective height from options
					height: `${options.height}px`,
					width: "100%",
					color: resolvedStyles.descriptionForeground,
				}}>
				No API requests made yet.
			</div>
		)
	}

	// Use effective height from options
	return (
		<div
			ref={chartRef}
			style={{
				width: "100%",
				height: `${options.height}px`,
				position: "relative",
				padding: 0,
				margin: 0,
				overflow: "visible", // Restore visible overflow
			}}
		/>
	)
}

export default CostTrendChart
