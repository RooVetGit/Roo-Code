import React, { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import CostTrendChart from "./CostTrendChart"
import { VSCodeDropdown, VSCodeOption, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { LayoutGrid } from "lucide-react" // Removed MoreVertical import

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
export type ChartType = "costDelta" | "cumulativeCost" | "tokensIn" | "tokensOut" // Limiting to 4 for grid view for now
// | "cacheReads" | "cacheWrites" // Can be added back if needed

const TaskCostChartSection: React.FC<TaskCostChartSectionProps> = ({ costHistory }) => {
	const { t } = useTranslation()
	const [selectedChartType, setSelectedChartType] = useState<ChartType>("costDelta")
	const [isGridView, setIsGridView] = useState<boolean>(false) // State for grid view
	const [chartHoverData, setChartHoverData] = useState<{
		isHovering: boolean
		index?: number
		value?: number
		type?: ChartType // Track which chart is being hovered in grid view
	} | null>(null)

	// Updated hover handler to accept yValue and optional type
	const handleChartHoverChange = useCallback(
		(
			hoverData: { isHovering: boolean; index?: number; yValue?: number } | null,
			type: ChartType = selectedChartType, // Default to selected type for single view
		) => {
			setChartHoverData(
				hoverData && hoverData.isHovering
					? {
							isHovering: true,
							index: hoverData.index,
							value: hoverData.yValue,
							type: type, // Store the type of the hovered chart
						}
					: null, // Reset if not hovering or data is invalid
			)
		},
		[selectedChartType], // Recreate if selectedChartType changes (for single view default)
	)

	// Function to get the title based on selected chart type
	const getChartTitle = (type: ChartType): string => {
		switch (type) {
			case "cumulativeCost":
				return t("chat:task.cumulativeCostChartTitle", "Cumulative Cost:")
			case "tokensIn":
				return t("chat:task.tokensInChartTitle", "Input Tokens") // Removed colon for grid titles
			case "tokensOut":
				return t("chat:task.tokensOutChartTitle", "Output Tokens") // Removed colon
			// case "cacheReads": return t("chat:task.cacheReadsChartTitle", "Cache Reads:")
			// case "cacheWrites": return t("chat:task.cacheWritesChartTitle", "Cache Writes:")
			case "costDelta":
			default:
				return t("chat:task.costChartTitle", "Cost / Request") // Removed colon
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
			return isGridView
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

		if (isGridView) {
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
	}, [costHistory, selectedChartType, isGridView])

	// Render only if costHistory is provided (even if empty, chart shows "No data")
	if (!costHistory) {
		return null // Don't render anything if costHistory is undefined
	}

	const handleDropdownChange = (event: any) => {
		setSelectedChartType(event.target.value as ChartType)
	}

	const toggleGridView = () => {
		setIsGridView(!isGridView)
		setChartHoverData(null) // Clear hover data on view change
	}

	// Determine the title and hover info based on view mode and hover state
	// const currentHoverType = chartHoverData?.type ?? selectedChartType // Removed unused variable
	const displayTitle = isGridView
		? t("chat:task.costOverviewTitle", "Cost Overview")
		: getChartTitle(selectedChartType)

	return (
		<div className="flex flex-col">
			{/* Header Row */}
			<div className="flex justify-between items-center h-[24px] mb-1">
				<div className="flex items-center gap-1 flex-grow min-w-0">
					<span className="font-bold whitespace-nowrap">{displayTitle}:</span>
					{/* Display hover data - uses chartHoverData.type to format correctly */}
					{chartHoverData?.isHovering &&
						chartHoverData.value !== undefined &&
						chartHoverData.index !== undefined && (
							<span className="truncate ml-1">
								{t("chat:task.chartHoverBase", "Req {{index}}: {{value}}", {
									index: chartHoverData.index,
									value: formatHoverValue(chartHoverData.type!, chartHoverData.value), // Use stored type
								})}
							</span>
						)}
				</div>
				{/* Controls */}
				<div className="flex items-center gap-1">
					{/* Dropdown (only in single view) */}
					{!isGridView && (
						<VSCodeDropdown
							value={selectedChartType}
							onChange={handleDropdownChange}
							className="min-w-[150px]">
							<VSCodeOption value="costDelta">
								{t("chat:task.costChartOption", "Cost / Request")}
							</VSCodeOption>
							<VSCodeOption value="cumulativeCost">
								{t("chat:task.cumulativeCostOption", "Cumulative Cost")}
							</VSCodeOption>
							<VSCodeOption value="tokensIn">
								{t("chat:task.tokensInOption", "Input Tokens")}
							</VSCodeOption>
							<VSCodeOption value="tokensOut">
								{t("chat:task.tokensOutOption", "Output Tokens")}
							</VSCodeOption>
							{/* <VSCodeOption value="cacheReads">{t("chat:task.cacheReadsOption", "Cache Reads")}</VSCodeOption> */}
							{/* <VSCodeOption value="cacheWrites">{t("chat:task.cacheWritesOption", "Cache Writes")}</VSCodeOption> */}
						</VSCodeDropdown>
					)}
					{/* Grid Toggle Button */}
					<VSCodeButton
						appearance="icon"
						onClick={toggleGridView}
						title={
							isGridView
								? t("chat:task.showSingleChart", "Show Single Chart")
								: t("chat:task.showChartGrid", "Show Chart Grid")
						}>
						<LayoutGrid size={16} />
					</VSCodeButton>
				</div>
			</div>

			{/* Chart Area */}
			{isGridView ? (
				// Grid View: 2x2 Grid
				// Use equal gap for equidistant spacing
				<div className="grid grid-cols-2 gap-4 px-2">
					{" "}
					{/* Added px-2 for horizontal padding */}
					{(["costDelta", "cumulativeCost", "tokensIn", "tokensOut"] as ChartType[]).map((type) => {
						const chartData = (preparedChartData as Record<ChartType, [number[], number[]]>)[type]
						const yAxisUnit = type === "costDelta" || type === "cumulativeCost" ? "$" : ""
						const chartHeight = 90 // Smaller height for grid charts
						// Determine if this chart is in the top row (costDelta or cumulativeCost)
						// const isTopRow = type === "costDelta" || type === "cumulativeCost" // Removed unused variable
						// Add check for left column for title alignment
						const isLeftColumn = type === "costDelta" || type === "tokensIn"

						return (
							<div key={type} className="flex flex-col pb-2">
								{" "}
								{/* Added pb-2 */}
								{/* Add title above each grid chart, conditionally right-align, lighter color */}
								<span
									className={`text-xs font-semibold mb-0.5 text-vscode-descriptionForeground ${!isLeftColumn ? "text-right" : ""}`}>
									{getChartTitle(type)}
								</span>
								<CostTrendChart
									chartData={chartData}
									// Pass type to hover handler
									onHoverChange={(d) => handleChartHoverChange(d, type)}
									yAxisUnit={yAxisUnit}
									chartLabel={getChartTitle(type)} // Use title as label
									height={chartHeight}
									// Hide X-axis completely for all grid charts
									showXAxis={false} // Replaced hideXAxisElements={isTopRow}
									axisFontSize="11px" // Smaller font size for grid axes
									syncKey={type} // Pass unique key to disable sync between grid charts
									hideYAxisZero={true} // Hide the zero label on the Y-axis for grid charts
									showGridLines={false} // Hide grid lines for grid charts
									// yAxisSide prop removed - will default to "left" in CostTrendChart
								/>
							</div>
						)
					})}
				</div>
			) : (
				// Single View
				<CostTrendChart
					chartData={preparedChartData as [number[], number[]]} // Cast for single view
					onHoverChange={handleChartHoverChange} // Uses default type
					yAxisUnit={
						selectedChartType === "costDelta" || selectedChartType === "cumulativeCost" ? "$" : "" // No unit for tokens/cache on axis
					}
					chartLabel={getChartTitle(selectedChartType)} // Use selected type title as label
					// No syncKey passed here, so sync is disabled in single view
					// yAxisSide prop removed - will default to "left" in CostTrendChart
					// height prop can be omitted to use default, or set explicitly
				/>
			)}
		</div>
	)
}

export default TaskCostChartSection
