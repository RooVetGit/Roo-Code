import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import CostTrendChart from "./CostTrendChart"
// Removed unused VSCodeDropdown, VSCodeOption imports
import {} from /* Button */ "@src/components/ui" // Import commented out since it's not used

// Define the extended data point interface
// Ensure all potential metrics are optional
interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
	tokensIn?: number // Optional: Input Tokens
	tokensOut?: number // Optional: Output Tokens
	cacheReads?: number // Optional: Cache Reads
	cacheWrites?: number // Optional: Cache Writes
}

interface TaskCostChartSectionProps {
	costHistory?: CostHistoryDataPoint[] // Use the extended interface
}

// Define the possible chart types
export type ChartType = "costDelta" | "cumulativeCost" | "tokensIn" | "tokensOut" | "gridView" // Added gridView as a chart type

// Removed CHART_TYPE_ORDER as it's no longer needed for cycling

const NARROW_THRESHOLD_PX = 300 // Threshold for switching hover text format

const TaskCostChartSection: React.FC<TaskCostChartSectionProps> = ({ costHistory }) => {
	const { t } = useTranslation()
	const [selectedChartType, setSelectedChartType] = useState<ChartType>("gridView") // Start with grid view
	const [_activelyHoveredChartType, setActivelyHoveredChartType] = useState<ChartType | null>(null) // Track direct hover
	const [chartHoverData, setChartHoverData] = useState<{
		isHovering: boolean
		index?: number
		value?: number
		type?: ChartType // Track which chart is being hovered in grid view
	} | null>(null)
	const [_isNarrow, setIsNarrow] = useState(false) // State for responsive text
	const gridContainerRef = useRef<HTMLDivElement>(null) // Ref for the grid container

	// Effect to observe grid container size
	useEffect(() => {
		const container = gridContainerRef.current
		if (!container) return

		const observer = new ResizeObserver((entries) => {
			for (let entry of entries) {
				// Use contentBoxSize for more reliable width
				const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
				setIsNarrow(width < NARROW_THRESHOLD_PX)
			}
		})

		observer.observe(container)

		// Initial check
		const initialWidth = container.getBoundingClientRect().width
		setIsNarrow(initialWidth < NARROW_THRESHOLD_PX)

		return () => {
			observer.disconnect()
		}
	}, [selectedChartType]) // Re-run if switching to/from grid view

	// Updated hover handler to accept yValue and optional type
	const handleChartHoverChange = useCallback(
		(
			hoverData: { isHovering: boolean; index?: number; yValue?: number } | null,
			type: ChartType = selectedChartType, // Default to selected type for single view
		) => {
			// Only update state if there's an actual change to prevent unnecessary re-renders
			setChartHoverData((prevData) => {
				// If both are null/falsy, no change needed
				if (!hoverData?.isHovering && !prevData) return prevData

				// If new data is not hovering but we had previous data, reset to null
				if (!hoverData?.isHovering) return null

				// If we have new hover data, create the new state
				const newData = {
					isHovering: true,
					index: hoverData.index,
					value: hoverData.yValue,
					type: type, // Store the type of the hovered chart
				}

				// In grid view, we want to update the hover data even if the index is the same
				// but we're hovering over a different chart type
				// This ensures all charts show hover data when any chart is hovered
				if (selectedChartType === "gridView") {
					// Always update state when hovering in grid view to ensure 'type' is correct
					return newData
				} else {
					// In single view, only update if something actually changed
					if (
						prevData?.isHovering &&
						prevData.index === newData.index &&
						prevData.value === newData.value &&
						prevData.type === newData.type
					) {
						return prevData
					}
					return newData
				}
			})
		},
		[selectedChartType], // Recreate if selectedChartType changes
	)

	// Create memoized hover handlers for each chart type in grid view
	const typeSpecificHoverHandlers = useMemo(() => {
		const handlers: Record<ChartType, (d: any) => void> = {
			costDelta: (d) => handleChartHoverChange(d, "costDelta"),
			cumulativeCost: (d) => handleChartHoverChange(d, "cumulativeCost"),
			tokensIn: (d) => handleChartHoverChange(d, "tokensIn"),
			tokensOut: (d) => handleChartHoverChange(d, "tokensOut"),
			gridView: (d) => handleChartHoverChange(d, "gridView"), // Should not be used, but included for completeness
		}
		return handlers
	}, [handleChartHoverChange])

	// Function to get the title based on selected chart type
	const getChartTitle = (type: ChartType): string => {
		switch (type) {
			case "cumulativeCost":
				return t("chat:task.totalCostChartTitle", "Total Cost") // Changed from Cumulative Cost
			case "tokensIn":
				return t("chat:task.tokensInChartTitle", "Input Tokens") // Removed colon for grid titles
			case "tokensOut":
				return t("chat:task.tokensOutChartTitle", "Output Tokens") // Removed colon
			// case "cacheReads": return t("chat:task.cacheReadsChartTitle", "Cache Reads:")
			// case "cacheWrites": return t("chat:task.cacheWritesChartTitle", "Cache Writes:")
			case "costDelta":
			default:
				return t("chat:task.requestCostChartTitle", "Request Cost") // Changed from Cost / Request
		}
	}

	// Function to get the full title for single chart view
	const getSingleChartTitle = (type: ChartType): string => {
		switch (type) {
			case "cumulativeCost":
				return t("chat:task.totalCostChartTitle", "Total Cost:") // Changed from Cumulative Cost
			case "tokensIn":
				return t("chat:task.tokensInChartTitle", "Input Tokens:")
			case "tokensOut":
				return t("chat:task.tokensOutChartTitle", "Output Tokens:")
			// case "cacheReads": return t("chat:task.cacheReadsChartTitle", "Cache Reads:")
			// case "cacheWrites": return t("chat:task.cacheWritesChartTitle", "Cache Writes:")
			case "costDelta":
			default:
				return t("chat:task.requestCostChartTitle", "Request Cost:") // Already has colon, ensuring consistency
		}
	}

	// Function to format the hover value based on selected chart type
	const formatHoverValue = (type: ChartType, value: number): string => {
		switch (type) {
			case "cumulativeCost":
			case "costDelta":
				// Use existing cost formatting logic
				return value < 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`
			case "tokensIn":
			case "tokensOut":
				return `${value.toLocaleString()} ${t("chat:task.tokensUnit", "tokens")}`
			// case "cacheReads": return `${value.toLocaleString()} ${t("chat:task.cacheReadsUnit", "reads")}`
			// case "cacheWrites": return `${value.toLocaleString()} ${t("chat:task.cacheWritesUnit", "writes")}`
			default:
				return String(value)
		}
	}

	// Prepare data for the chart(s) based on the selected type and view mode
	// Returns either a single [x, y] array or an object with four [x, y] arrays
	const preparedChartData = useMemo(() => {
		if (!costHistory || costHistory.length === 0) {
			return selectedChartType === "gridView"
				? { costDelta: [[], []], cumulativeCost: [[], []], tokensIn: [[], []], tokensOut: [[], []] }
				: [[], []]
		}

		const requestIndices = costHistory.map((d) => d.requestIndex)

		const getDataForType = (type: ChartType): number[] => {
			return costHistory.map((d) => {
				switch (type) {
					case "cumulativeCost":
						return d.cumulativeCost ?? 0
					case "tokensIn":
						return d.tokensIn ?? 0
					case "tokensOut":
						return d.tokensOut ?? 0
					// case "cacheReads": return d.cacheReads ?? 0
					// case "cacheWrites": return d.cacheWrites ?? 0
					case "costDelta":
					default:
						return d.costDelta ?? 0
				}
			})
		}

		if (selectedChartType === "gridView") {
			return {
				costDelta: [requestIndices, getDataForType("costDelta")],
				cumulativeCost: [requestIndices, getDataForType("cumulativeCost")],
				tokensIn: [requestIndices, getDataForType("tokensIn")],
				tokensOut: [requestIndices, getDataForType("tokensOut")],
			}
		} else {
			// Single view: return data for the selected type
			return [requestIndices, getDataForType(selectedChartType)]
		}
	}, [costHistory, selectedChartType])

	// Define hooks at the top level, outside of any conditional blocks
	// Click handler for the single chart view to go back to grid view
	const handleSingleChartClick = useCallback(() => {
		// Immediately set the state to switch view and clear hover data.
		// Remove the setTimeout delay.
		setSelectedChartType("gridView")
		setChartHoverData(null) // Clear hover data when switching back
	}, []) // No dependencies needed

	// Handler to clear hover data when mouse leaves the entire section
	const handleMouseLeaveSection = useCallback(() => {
		setChartHoverData(null)
	}, []) // No dependencies needed

	// Render only if costHistory is provided (even if empty, chart shows "No data")
	if (!costHistory) {
		return null // Don't render anything if costHistory is undefined
	}

	// Removed cycleToNextChartType function

	// Determine the title and hover info based on view mode and hover state
	const displayTitle =
		selectedChartType === "gridView"
			? t("chat:task.costOverviewTitle", "Cost Overview")
			: getSingleChartTitle(selectedChartType)

	return (
		// Add onMouseLeave to the main container
		<div className="flex flex-col" onMouseLeave={handleMouseLeaveSection}>
			{/* Header Row - Only shown in single chart view */}
			{/* Header Row - Only shown in single chart view */}
			{selectedChartType !== "gridView" && (
				<div className="flex items-center h-[24px] mb-2">
					{" "}
					{/* Removed justify-between */}
					{/* Container for Title and Hover Value */}
					<div className="flex items-center gap-1 flex-grow min-w-0">
						{" "}
						{/* Re-added gap-1, flex-grow */}
						{/* Static Title */}
						<span className="font-bold whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0">
							{" "}
							{/* Added text-ellipsis */}
							{displayTitle}
						</span>
						{/* Hover Value */}
						{chartHoverData?.isHovering &&
							chartHoverData.index !== undefined &&
							chartHoverData.value !== undefined &&
							chartHoverData.type !== undefined && (
								<span className="truncate flex-shrink-0 ml-1 text-vscode-descriptionForeground">
									{" "}
									{/* Added text color */}
									{/* Format: Request Index: Value */}
									{`${t("chat:task.requestShort", "Request {{index}}:", { index: chartHoverData.index })} ${formatHoverValue(chartHoverData.type, chartHoverData.value)}`}
								</span>
							)}
					</div>
				</div>
			)}

			{/* Chart Area */}
			{selectedChartType === "gridView" ? (
				// Grid View: 2x2 Grid with just a cross divider
				<div ref={gridContainerRef} className="grid grid-cols-2 gap-0">
					{" "}
					{/* Added ref */}
					{/* Simple grid with no outer border */}
					{(["costDelta", "cumulativeCost", "tokensIn", "tokensOut"] as ChartType[]).map((type) => {
						const chartData = (preparedChartData as Record<ChartType, [number[], number[]]>)[type]
						const yAxisUnit = type === "costDelta" || type === "cumulativeCost" ? "$" : ""
						const chartHeight = 60 // Reverted height as header exists for single view

						// Determine position for styling
						const isTopLeft = type === "costDelta"
						const isTopRight = type === "cumulativeCost"
						const isBottomLeft = type === "tokensIn"
						const isBottomRight = type === "tokensOut"

						// Create classes for the simple cross divider effect
						const borderClasses = [
							// Only add right border to left column charts (vertical divider)
							isTopLeft || isBottomLeft ? "border-r border-vscode-panel-border" : "",
							// Only add bottom border to top row charts (horizontal divider)
							isTopLeft || isTopRight ? "border-b border-vscode-panel-border" : "",
						]
							.join(" ")
							.trim()

						// --- Refactored Hover Value Calculation ---
						let hoverValueDisplay = ""
						// Display hover value if *any* chart is hovered in the grid
						if (chartHoverData?.isHovering && chartHoverData.index !== undefined) {
							const dataPoint = costHistory.find((d) => d.requestIndex === chartHoverData.index)
							if (dataPoint) {
								let value = 0
								switch (type) {
									case "costDelta":
										value = dataPoint.costDelta
										break
									case "cumulativeCost":
										value = dataPoint.cumulativeCost
										break
									case "tokensIn":
										value = dataPoint.tokensIn || 0
										break
									case "tokensOut":
										value = dataPoint.tokensOut || 0
										break
								}
								// Conditionally format based on isNarrow state
								// Format as : index
								const requestText = `: ${chartHoverData.index}`
								// Display value first, then the separator and request number
								hoverValueDisplay = `${formatHoverValue(type, value)} ${requestText}`
							}
						}
						// --- End Refactored Hover Value Calculation ---

						return (
							// Chart Item Container
							<div
								key={type}
								className={`flex flex-col ${borderClasses} cursor-pointer`} // Grid charts already have cursor-pointer
								onClick={() => {
									// This onClick handles grid -> single view
									setSelectedChartType(type)
									setChartHoverData(null) // Clear hover data on chart type change
									setActivelyHoveredChartType(null) // Clear direct hover state too
								}}
								title={t("chat:task.clickToEnlarge", "Click to enlarge")}
								onMouseEnter={() => setActivelyHoveredChartType(type)} // Set direct hover type
								onMouseLeave={() => setActivelyHoveredChartType(null)} // Clear direct hover type
							>
								{/* Chart Item Header */}
								{/* Adjusted py-1 for consistent vertical spacing, removed mb-2 and conditional pt-2.5 */}
								{/* Use fixed height h-[24px] and mb-1 for alignment consistency */}
								{/* Header: Swap order - Hover Value on Left, Title on Right */}
								{/* Header: Title on Left, Hover Value on Right */}
								<div
									className={`h-[24px] mb-1 flex items-center justify-between min-w-0 ${isTopRight || isBottomRight ? "pl-2.5" : "pl-0"} ${isTopLeft || isBottomLeft ? "pr-2.5" : ""}`}>
									{/* Static Title Container (Left) - Allow shrinking/truncation */}
									<div className="flex items-center overflow-hidden min-w-0 flex-shrink mr-1">
										<span className="font-bold text-vscode-descriptionForeground whitespace-nowrap truncate">
											{getChartTitle(type)}
										</span>
									</div>
									{/* Hover Value Container (Right) - Don't shrink */}
									<div className="flex items-center overflow-hidden min-w-0 flex-shrink-0 ml-1">
										{hoverValueDisplay ? (
											<span className="truncate text-vscode-descriptionForeground">
												{hoverValueDisplay}
											</span>
										) : (
											<span>&nbsp;</span> // Placeholder
										)}
									</div>
								</div>{" "}
								{/* Closing Chart Item Header Div */}
								<CostTrendChart
									chartData={chartData}
									// Use pre-memoized handler for this specific chart type
									onHoverChange={typeSpecificHoverHandlers[type]}
									yAxisUnit={yAxisUnit}
									chartLabel={getChartTitle(type)} // Use title as label
									height={chartHeight}
									// Hide X-axis completely for all grid charts
									showXAxis={false} // Hide X-axis for grid charts
									showYAxis={false} // Hide Y-axis for grid charts
									axisFontSize="11px" // Smaller font size for grid axes
									hideYAxisZero={true} // Hide the zero label on the Y-axis for grid charts
									showGridLines={true} // Show grid lines to prevent individual chart borders
									// Add padding where charts meet the cross, ensure left charts have 0 left padding
									padding={[
										0,
										isTopLeft || isBottomLeft ? 10 : 5,
										5,
										isTopRight || isBottomRight ? 10 : 0,
									]}
									// Use "grid" as syncKey to enable synchronized cursor across all grid charts
									syncKey="grid"
									// No onClick needed for grid charts, the wrapper div handles it
								/>
							</div> // Closing Chart Item Container Div
						)
					})}
				</div> // Closing Grid View Div
			) : (
				// Single View - Wrap CostTrendChart in a div with cursor-pointer
				<div
					className="cursor-pointer w-full p-0 m-0"
					title={t("chat:task.clickToGoBack", "Click to go back to grid view")}>
					<CostTrendChart
						chartData={preparedChartData as [number[], number[]]} // Cast for single view
						onHoverChange={typeSpecificHoverHandlers[selectedChartType]} // Use memoized handler for selected type
						onClick={handleSingleChartClick} // Re-add onClick prop to pass the handler
						height={145} // Adjusted height to match grid view total height (177px) minus header (32px)
						yAxisUnit={
							selectedChartType === "costDelta" || selectedChartType === "cumulativeCost" ? "$" : "" // No unit for tokens/cache on axis
						}
						chartLabel={getChartTitle(selectedChartType)} // Use selected type title as label
						yAxisSide="right" // Position Y-axis on the right side
						padding={[0, 0, 0, 0]} // No padding to ensure axis touches the edge
						// No syncKey passed here, so sync is disabled in single view
					/>
				</div>
			)}
		</div> // Closing Main Container Div
	)
}

export default TaskCostChartSection
