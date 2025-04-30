import React, { useRef, useEffect, useMemo, useState } from "react" // Added useState
import uPlot, { type Options } from "uplot"
import "uplot/dist/uPlot.min.css" // Import base uPlot CSS

// Define the structure of the input data points
interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number // Kept for data structure consistency, but not plotted
	costDelta: number // This will be plotted
}

// Define the props for the new component
interface CostTrendChartProps {
	data: CostHistoryDataPoint[]
	// Callback to notify parent about hover state and data
	onHoverChange: (hoverData: { isHovering: boolean; index?: number; cost?: number } | null) => void
}

// Helper function to get computed style with fallback
const getResolvedStyle = (variableName: string, fallback: string): string => {
	if (typeof window !== "undefined") {
		return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback
	}
	return fallback // Fallback for SSR or testing environments
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({ data, onHoverChange }) => {
	const chartRef = useRef<HTMLDivElement>(null)
	const uplotInstanceRef = useRef<uPlot | null>(null)

	// State to hold resolved VS Code theme colors
	const [resolvedStyles, setResolvedStyles] = useState({
		foreground: "#cccccc", // Default fallbacks
		buttonForeground: "#ffffff",
		editorBackground: "#1e1e1e",
		tabsBorder: "#555555",
		selectionBackground: "rgba(255, 255, 255, 0.2)",
		widgetBackground: "#252526",
		widgetBorder: "#454545",
		descriptionForeground: "#8b949e", // Added for empty state text
		fontSize: "13px", // Default font size
		fontFamily: "sans-serif", // Default font family
	})

	// Effect to read styles on mount
	useEffect(() => {
		setResolvedStyles({
			foreground: getResolvedStyle("--vscode-foreground", "#cccccc"),
			buttonForeground: getResolvedStyle("--vscode-button-foreground", "#ffffff"),
			editorBackground: getResolvedStyle("--vscode-editor-background", "#1e1e1e"),
			tabsBorder: getResolvedStyle("--vscode-editorGroupHeader-tabsBorder", "#555555"),
			selectionBackground: getResolvedStyle("--vscode-editor-selectionBackground", "rgba(255, 255, 255, 0.2)"),
			widgetBackground: getResolvedStyle("--vscode-editorWidget-background", "#252526"),
			widgetBorder: getResolvedStyle("--vscode-editorWidget-border", "#454545"),
			descriptionForeground: getResolvedStyle("--vscode-descriptionForeground", "#8b949e"),
			fontSize: getResolvedStyle("--vscode-font-size", "13px"),
			fontFamily: getResolvedStyle("--vscode-font-family", "sans-serif"),
		})
		// Optional: Add listener for theme changes if available
	}, [])

	// 1. Transform data for uPlot: [xValues, yValues]
	const uplotData = useMemo(() => {
		if (!data || data.length === 0) {
			return [[], []] // uPlot expects arrays of data for each series
		}

		// Convert to typed arrays for uPlot
		const requestIndices = data.map((d) => d.requestIndex)
		const costDeltas = data.map((d) => d.costDelta)

		// Cast to any to bypass TypeScript error - uPlot actually accepts regular arrays
		return [requestIndices, costDeltas] as any
	}, [data])

	// 2. Define uPlot Options using resolved styles
	const options = useMemo(
		(): Options => ({
			width: 400, // Initial width, will be updated by resize handler
			height: 180, // Increased height to prevent legend overflow
			padding: [10, 10, 0, 0], // [top, right, bottom, left] - Minimal padding
			series: [
				{}, // X-axis series (requestIndex) - Options can be added if needed
				{
					// Y-axis series (costDelta)
					label: "Task Cost", // Legend label
					stroke: resolvedStyles.buttonForeground, // Use resolved value
					width: 2.5 / (window.devicePixelRatio || 1), // Slightly thicker line for better visibility
					points: { show: false }, // Hide points on the line itself
					scale: "$", // Link to the '$' scale defined below
				},
			],
			axes: [
				{
					// X-axis (requestIndex) - Bottom
					stroke: resolvedStyles.foreground, // Use resolved value
					grid: {
						stroke: resolvedStyles.tabsBorder, // Use resolved value
						width: 1 / (window.devicePixelRatio || 1),
						// alpha: 0.5, // alpha might not be directly supported here, use rgba in stroke if needed
					},
					ticks: {
						stroke: resolvedStyles.tabsBorder, // Changed to tabsBorder for darker grey
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					font: `${resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`, // Use resolved font size and family
					size: 30, // Allocate space for labels if needed, adjust as necessary
					// label: "Request Index", // Removed label
					// labelSize: 20, // No longer needed
					// labelFont: `${resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`, // No longer needed
					// Label color is typically inherited from axis stroke or font color setting
					// Ensure integer ticks by specifying increments starting with 1
					incrs: [1, 2, 5, 10, 20, 50, 100], // Define possible increments for ticks
					space: 30, // Minimum space between ticks in pixels, adjust as needed
					// Format X-axis ticks as whole numbers (still useful as a fallback)
					values: (u: uPlot, ticks: number[]) =>
						ticks.map((rawValue: number) => Math.round(rawValue).toString()),
				},
				{
					// Y-axis (costDelta) - Right
					scale: "$", // Link to the '$' scale
					side: 1, // 1 = right side
					// align: 1, // Removed potentially invalid align property
					stroke: resolvedStyles.foreground, // Use resolved value
					grid: {
						stroke: resolvedStyles.tabsBorder, // Use resolved value
						width: 1 / (window.devicePixelRatio || 1),
						// alpha: 0.5,
					},
					ticks: {
						stroke: resolvedStyles.tabsBorder, // Changed to tabsBorder for darker grey
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					font: `${resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`, // Use resolved font size and family
					// stroke: resolvedStyles.foreground, // This sets the axis line/tick color, text color is often inferred or set by 'font'
					// Ensure distinct currency ticks
					incrs: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100], // Define possible increments for currency ticks
					space: 30, // Minimum space between ticks in pixels, adjust as needed
					// Format Y-axis ticks as currency
					values: (u: uPlot, ticks: number[]) => ticks.map((rawValue: number) => `$${rawValue.toFixed(2)}`),
					size: 55, // Allocate space for labels like "$1.50" (Keep space for values)
					// label: "Cost ($)", // Removed label
					// labelSize: 20, // No longer needed without label
					// labelFont: `${resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`, // No longer needed without label
					// Label color is typically inherited from axis stroke or font color setting
					// size: 40, // Removed erroneous duplicate size property
				},
			],
			scales: {
				x: {
					// Define the scale for the X-axis (requestIndex)
					time: false, // Treat x-values as numbers, not timestamps
					auto: true, // Automatically determine range (Reverted)
				},
				$: {
					// Define the scale used by the Y-axis series and axis
					auto: true, // Automatically determine range based on data
					range: [0, null], // Ensure Y-axis starts at 0, max auto-determined
				},
			},
			cursor: {
				// Optional: Customize cursor/tooltip behavior
				drag: { x: true, y: false, setScale: true }, // Allow horizontal drag-to-zoom
				points: {
					// Style points shown on hover
					show: true,
					size: 6 / (window.devicePixelRatio || 1),
					stroke: resolvedStyles.buttonForeground, // Use resolved value
					fill: resolvedStyles.editorBackground, // Use resolved value
				},
				focus: {
					prox: 30, // Larger proximity for easier interaction
				},
				// Tooltip customization (basic example)
				// You might need a more complex hook for full tooltip parity if required
				sync: { key: "cost-chart-sync" }, // Optional: Sync cursor with other charts if needed
			},
			legend: {
				show: false, // Attempt to disable the default tooltip by hiding the legend
				// Styling for legend DOM element is handled by injected CSS below
			},
			hooks: {
				// Hook to capture cursor position changes - needs to be an array
				setCursor: [
					(u: uPlot) => {
						const { idx } = u.cursor // idx is the index of the hovered data point

						if (idx != null) {
							// Cursor is over a data point
							const requestIndex = u.data[0]?.[idx] // Use optional chaining
							const costDelta = u.data[1]?.[idx] // Use optional chaining

							// Ensure data is valid before calling callback
							if (typeof requestIndex === "number" && typeof costDelta === "number") {
								console.log(`[CostTrendChart Hover] Index: ${requestIndex}, CostDelta: ${costDelta}`) // <-- Add logging
								onHoverChange({ isHovering: true, index: requestIndex, cost: costDelta })
							} else {
								// Data point invalid, treat as not hovering
								console.log(`[CostTrendChart Hover] Invalid data at uPlot index: ${idx}`) // <-- Add logging
								onHoverChange({ isHovering: false })
							}
						} else {
							// Cursor is not over a data point (or left the plot area)
							// console.log("[CostTrendChart Hover] Cursor off point"); // Optional logging
							onHoverChange({ isHovering: false })
						}
					},
				],
				// Optional: Hook to clear hover state when leaving the plot area
				// Using hooks.destroy might be more reliable for cleanup on mouseleave
				// destroy: [(u: uPlot) => {
				//   onHoverChange({ isHovering: false });
				// }]
				// Note: A more robust 'mouseleave' might require adding event listeners directly to chartRef.current
			},
		}),
		[resolvedStyles, onHoverChange],
	) // Recreate options when resolved styles or callback change

	// 3. Manage uPlot instance lifecycle and resizing
	useEffect(() => {
		// console.log("uPlot effect running, data length:", uplotData[0].length);

		if (chartRef.current && uplotData[0].length > 0) {
			// console.log("Creating uPlot instance with options:", options);

			// Destroy previous instance if it exists
			uplotInstanceRef.current?.destroy()

			try {
				// Create new uPlot instance
				const uplotInstance = new uPlot(options, uplotData, chartRef.current)
				uplotInstanceRef.current = uplotInstance
				// console.log("uPlot instance created successfully");
			} catch (error) {
				console.error("Error creating uPlot instance:", error)
				// console.error("Options used:", options);
				// console.error("Data used:", uplotData);
			}

			// Resize handler
			const handleResize = () => {
				if (chartRef.current && uplotInstanceRef.current) {
					uplotInstanceRef.current.setSize({
						width: chartRef.current.offsetWidth,
						height: options.height!, // Use height from options
					})
				}
			}

			// Initial size calculation and event listener setup
			handleResize() // Set initial size based on container
			window.addEventListener("resize", handleResize)

			// Cleanup on component unmount or before re-creation
			return () => {
				window.removeEventListener("resize", handleResize)
				uplotInstanceRef.current?.destroy()
				uplotInstanceRef.current = null
			}
		} else if (uplotInstanceRef.current) {
			// If data becomes empty, destroy the existing chart
			uplotInstanceRef.current.destroy()
			uplotInstanceRef.current = null
		}
		// Ensure effect re-runs if options or data change
	}, [options, uplotData])

	// Add custom CSS to override uPlot default styles using resolved colors
	// Moved BEFORE the early return to comply with Rules of Hooks
	useEffect(() => {
		const styleId = "uplot-custom-styles"
		// Remove existing style tag if present
		document.getElementById(styleId)?.remove()

		// Only add styles if the chart is actually going to be rendered
		if (uplotData && uplotData[0].length > 0) {
			// Add a style tag to the document head
			const styleEl = document.createElement("style")
			styleEl.id = styleId
			styleEl.innerHTML = `
        .u-legend {
          color: ${resolvedStyles.foreground} !important;
          background: ${resolvedStyles.editorBackground} !important;
          /* Add some padding/margin if needed, but be mindful of height */
          margin-bottom: 5px !important; /* Example margin */
        }
        .u-legend th, .u-legend td { /* Target table cells too */
          color: ${resolvedStyles.foreground} !important;
          padding: 2px 5px !important; /* Adjust padding */
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
          z-index: 10 !important; /* Ensure tooltip is above other elements */
        }
        /* Style legend markers if needed */
         .u-legend .u-marker {
           border-color: ${resolvedStyles.buttonForeground} !important; /* Example */
         }
      `
			document.head.appendChild(styleEl)
		}

		// No cleanup needed here as we replace the style tag by ID
	}, [resolvedStyles, uplotData]) // Re-apply styles if resolvedStyles or data presence change

	// 4. Render the container or empty state message
	if (!uplotData || uplotData[0].length === 0) {
		// Display a message if there's no data, maintaining the space
		return (
			<div
				className="text-xs p-2 flex items-center justify-center"
				style={{
					height: `${options.height}px`, // Match chart height from options
					width: "100%",
					color: resolvedStyles.descriptionForeground, // Use resolved color
				}}>
				No cost data available yet.
			</div>
		)
	}

	// Render the div container for uPlot
	// Use height from options object
	// Add position: relative to establish positioning context, but remove overflow: hidden
	return <div ref={chartRef} style={{ width: "100%", height: `${options.height}px`, position: "relative" }} />
}

export default CostTrendChart
