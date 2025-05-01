import React, { useRef, useEffect, useMemo, useState } from "react"
import uPlot, { type Options, type AlignedData } from "uplot"
import "uplot/dist/uPlot.min.css"

// Data is now expected as pre-processed [xValues, yValues]
type ChartData = AlignedData | undefined // uPlot.AlignedData is typically [number[], number[], ...]

interface CostTrendChartProps {
	chartData: ChartData // Renamed from 'data' and changed type
	onHoverChange: (hoverData: { isHovering: boolean; index?: number; yValue?: number } | null) => void // Changed 'cost' to 'yValue'
	yAxisUnit?: string
	chartLabel?: string // Optional label for the series
	height?: number // Optional height override
	showXAxis?: boolean // Prop to control X-axis visibility (re-added)
	yAxisSide?: "left" | "right" // Prop to control Y-axis side
	axisFontSize?: string // Optional prop for axis font size
	syncKey?: string // Optional key for cursor synchronization
	hideYAxisZero?: boolean // Optional: Hide the zero value on the Y axis
	showGridLines?: boolean // Optional: Control visibility of grid lines
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
	yAxisUnit = "$",
	chartLabel = "Value", // Default label
	height = 180, // Default height
	showXAxis = true, // Default to true (re-added)
	// hideXAxisElements removed
	yAxisSide = "left", // Default to LEFT now
	axisFontSize,
	syncKey, // Add the new prop
	hideYAxisZero = false, // Default to false
	showGridLines = true, // Default to true
}) => {
	const chartRef = useRef<HTMLDivElement>(null)
	const uplotInstanceRef = useRef<uPlot | null>(null)

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
					// Check specifically for VS Code theme classes if needed, or just update on any class change
					// Example: (mutation.target as HTMLElement).className.includes('vscode-')
					updateStyles()
					break // Only need to update once per batch of mutations
				}
			}
		})

		observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

		// Cleanup observer on component unmount
		return () => observer.disconnect()
	}, [])

	// Remove the internal uplotData calculation, use chartData prop directly
	// const uplotData = useMemo(() => { ... }, [data])

	const options = useMemo((): Options => {
		// Define scale matching functions
		const matchSyncKeys = (ownScaleKey: string | null, extScaleKey: string | null) => ownScaleKey === extScaleKey // Match if keys are identical
		// const neverMatch = (ownScaleKey: string | null, extScaleKey: string | null) => false // Removed unused function

		// Use chartData directly for checks
		const numberOfPoints = chartData?.[0]?.length ?? 0
		const showPointsOnly = numberOfPoints === 1
		const pointSize = 6 / (window.devicePixelRatio || 1)
		const effectiveHeight = height ?? 180 // Use prop or default

		return {
			width: 400, // This will be overridden by resize handler
			height: effectiveHeight, // Use effective height
			padding: [10, 0, 0, 0],
			series: [
				{}, // X-axis series
				{
					label: chartLabel, // Use the chartLabel prop
					stroke: resolvedStyles.buttonForeground,
					width: showPointsOnly ? 0 : 2.5 / (window.devicePixelRatio || 1),
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
				// X-Axis Configuration
				{
					show: showXAxis, // Control visibility with the prop
					stroke: showXAxis ? resolvedStyles.foreground : "transparent", // Hide stroke if axis hidden
					grid: {
						show: showXAxis && showGridLines, // Hide grid lines if axis hidden OR prop is false
						stroke: resolvedStyles.tabsBorder,
						width: 1 / (window.devicePixelRatio || 1),
					},
					ticks: {
						show: showXAxis, // Hide ticks if axis hidden
						stroke: resolvedStyles.descriptionForeground, // Brighter grey
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					// Use axisFontSize if provided, otherwise default
					font: `${axisFontSize || resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`,
					size: showXAxis ? 30 : 0, // Set size to 0 if hidden to reclaim space
					incrs: [1, 2, 5, 10, 20, 50, 100],
					space: 30,
					// Only format values if axis is shown
					values: showXAxis
						? (u: uPlot, ticks: number[]) => {
								return ticks.map((rawValue: number) => {
									const roundedValue = Math.round(rawValue)
									// Don't show 0 on the x-axis label
									return roundedValue === 0 ? "" : roundedValue.toString()
								})
							}
						: undefined, // Pass undefined if hidden
				},
				// Y-Axis Configuration (unchanged)
				// Y-Axis Configuration
				{
					scale: "$", // This scale name is used by the series config
					side: yAxisSide === "left" ? 3 : 1, // Use prop to set side (1=right, 3=left)
					stroke: resolvedStyles.foreground,
					grid: {
						show: showGridLines, // Control grid visibility with prop
						stroke: resolvedStyles.tabsBorder,
						width: 1 / (window.devicePixelRatio || 1),
					},
					ticks: {
						stroke: resolvedStyles.descriptionForeground, // Brighter grey
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					// Use axisFontSize if provided, otherwise default
					font: `${axisFontSize || resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`,
					// Add larger increments for token counts
					incrs: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
					space: 30,
					// Format based on yAxisUnit, optionally hiding zero
					values: (u: uPlot, ticks: number[]) =>
						ticks.map((rawValue: number) => {
							// Hide zero if the prop is set and value is zero
							if (hideYAxisZero && rawValue === 0) {
								return ""
							}
							// Otherwise, format as usual
							if (yAxisUnit === "$") {
								// Format as currency
								return `${yAxisUnit}${rawValue.toFixed(2)}`
							} else {
								// Format as locale-specific whole number for tokens/cache
								return rawValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
							}
						}),
					// Increase size to accommodate potentially larger labels
					size: 65,
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
				lock: true, // Keep lock: true for persistence on hover stop
				drag: { x: true, y: false, setScale: true },
				points: {
					show: true,
					size: 6 / (window.devicePixelRatio || 1),
					stroke: resolvedStyles.buttonForeground,
					fill: resolvedStyles.editorBackground,
				},
				focus: {
					prox: 30,
				},
				// Conditionally add sync object only if syncKey is provided
				...(syncKey && {
					sync: {
						key: syncKey,
						setSeries: true,
						match: [matchSyncKeys, matchSyncKeys], // Use standard match when sync is enabled
					},
				}),
			},
			legend: {
				show: false,
			},
			hooks: {
				setCursor: [
					(u: uPlot) => {
						const { idx } = u.cursor

						if (idx != null) {
							const requestIndex = u.data[0]?.[idx] // X value (request index)
							const yValue = u.data[1]?.[idx] // Y value (the metric being plotted)

							if (typeof requestIndex === "number" && typeof yValue === "number") {
								// Pass the raw yValue back
								onHoverChange({ isHovering: true, index: requestIndex, yValue: yValue })
							} else {
								onHoverChange({ isHovering: false }) // Reset if data is invalid
							}
						} else {
							onHoverChange({ isHovering: false }) // Reset when cursor leaves
						}
					},
				],
				// Add hook to draw a border around the plot area when grid lines are hidden
				draw: [
					(u: uPlot) => {
						// Only draw the border if default grid lines are hidden
						if (!showGridLines) {
							const ctx = u.ctx // Get context from uPlot instance
							const { left, top, width, height } = u.bbox // Get plot area bounds

							// Draw the border rectangle
							ctx.save()
							ctx.strokeStyle = resolvedStyles.descriptionForeground // Brighter grey
							ctx.lineWidth = 1 / (window.devicePixelRatio || 1) // Use same width
							ctx.strokeRect(left, top, width, height)
							ctx.restore()
						}
					},
				],
			},
		}
		// Update dependencies: re-add showXAxis, remove hideXAxisElements
	}, [
		resolvedStyles,
		onHoverChange,
		chartData,
		yAxisUnit,
		chartLabel,
		height,
		showXAxis,
		yAxisSide,
		axisFontSize,
		syncKey,
		hideYAxisZero,
		showGridLines,
	])

	useEffect(() => {
		// Check chartData instead of uplotData
		if (chartRef.current && chartData && chartData[0] && chartData[0].length > 0) {
			uplotInstanceRef.current?.destroy() // Destroy previous instance if exists

			try {
				// Pass chartData directly
				const uplotInstance = new uPlot(options, chartData, chartRef.current)
				uplotInstanceRef.current = uplotInstance
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
				uplotInstanceRef.current?.destroy()
				uplotInstanceRef.current = null // Clear ref on cleanup
			}
		} else if (uplotInstanceRef.current) {
			// If data becomes empty/invalid, destroy the existing chart
			uplotInstanceRef.current.destroy()
			uplotInstanceRef.current = null
		}
		// Update dependencies: use chartData instead of uplotData
	}, [options, chartData])

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
	        .u-legend .u-marker {
	          border-color: ${resolvedStyles.buttonForeground} !important;
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
				No data available for this chart.
			</div>
		)
	}

	// Use effective height from options
	return <div ref={chartRef} style={{ width: "100%", height: `${options.height}px`, position: "relative" }} />
}

export default CostTrendChart
// Export the ChartType for use in the parent component
// Assuming ChartType is defined in TaskCostChartSection or needs to be moved/defined here.
// If it's in TaskCostChartSection, this export might cause circular dependency issues.
// Consider defining ChartType in a shared types file or directly here if not already shared.
// For now, commenting out as it depends on TaskCostChartSection structure.
// export type { ChartType } from "./TaskCostChartSection"
