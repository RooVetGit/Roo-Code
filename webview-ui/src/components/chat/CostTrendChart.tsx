import React from "react" // Import useState
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { cn } from "@/lib/utils" // Import cn utility
import type { CostViewMode } from "./TaskHeader" // Import the type
// Removed: import { useTheme } from 'styled-components';

// Define the structure of the data points we expect
interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
}

interface CostTrendChartProps {
	data: CostHistoryDataPoint[]
	costThreshold?: number // Optional threshold line value
	viewMode: CostViewMode // Add viewMode prop
	onViewModeChange: (newMode: CostViewMode) => void // Add handler prop
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({
	data,
	costThreshold = 2.0,
	viewMode, // Use prop
	onViewModeChange, // Use prop
}) => {
	// Remove internal state: const [viewMode, setViewMode] = useState<'cumulative' | 'task'>('cumulative');

	// Format Y-axis ticks as currency
	const formatYAxis = (tickItem: number) => `$${tickItem.toFixed(2)}`

	// Custom Tooltip
	const CustomTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const pointData = payload[0].payload as CostHistoryDataPoint
			// Use solid background, less padding, restore secondary info with minimal spacing
			return (
				<div className="bg-vscode-editorHoverWidget-background border border-vscode-widget-border p-1 rounded text-vscode-editorWidget-foreground text-xs shadow-lg leading-tight">
					{" "}
					{/* Added leading-tight */}
					<p className="font-bold">{`Req: ${label}`}</p> {/* Removed mb-1 */}
					{viewMode === "cumulative" ? (
						<>
							<p className="font-semibold">{`Cumul: $${pointData.cumulativeCost.toFixed(4)}`}</p>
							<p className="opacity-80">{`Task: $${pointData.costDelta.toFixed(4)}`}</p>{" "}
							{/* Restored secondary info */}
						</>
					) : (
						// Else block (viewMode must be 'task')
						<>
							<p className="font-semibold">{`Task: $${pointData.costDelta.toFixed(4)}`}</p>
							<p className="opacity-80">{`Cumul: $${pointData.cumulativeCost.toFixed(4)}`}</p>{" "}
							{/* Restored secondary info */}
						</>
					)}
				</div>
			)
		}
		return null
	}

	if (!data || data.length === 0) {
		return <div className="text-xs text-vscode-descriptionForeground p-2">No cost data available yet.</div>
	}

	const dataKey = viewMode === "cumulative" ? "cumulativeCost" : "costDelta"

	return (
		<div className="flex flex-col gap-1 w-full">
			{" "}
			{/* Added w-full */}
			{/* View Mode Toggle Tabs (Styled like SelectDropdown Trigger) */}
			<div className="flex justify-start pl-1">
				<div className="inline-flex rounded-md border border-[rgba(255,255,255,0.08)] overflow-hidden">
					<button
						type="button"
						onClick={() => onViewModeChange("cumulative")} // Call prop handler
						className={cn(
							"px-2 py-0.5 text-xs focus:outline-none transition-colors duration-150", // Base styles
							"border-r border-[rgba(255,255,255,0.08)]", // Separator border
							viewMode === "cumulative"
								? "bg-[rgba(255,255,255,0.05)] text-vscode-foreground opacity-100" // Active style (subtle background)
								: "bg-transparent text-vscode-foreground opacity-70 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]", // Inactive style
						)}
						title="Show cumulative cost">
						Cumul.
					</button>
					<button
						type="button"
						onClick={() => onViewModeChange("task")} // Call prop handler
						className={cn(
							"px-2 py-0.5 text-xs focus:outline-none transition-colors duration-150", // Base styles
							viewMode === "task" // Check for 'task' mode
								? "bg-[rgba(255,255,255,0.05)] text-vscode-foreground opacity-100" // Active style (subtle background)
								: "bg-transparent text-vscode-foreground opacity-70 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]", // Inactive style
						)}
						title="Show per-request cost (Task)" // Updated title
					>
						Task
					</button>
				</div>
			</div>
			{/* Chart Container */}
			<div style={{ width: "100%", height: 150 }}>
				<ResponsiveContainer>
					<LineChart
						data={data}
						margin={{
							top: 5,
							right: 10, // Reduced right margin as YAxis width handles spacing
							left: 5, // Decreased left margin
							bottom: 5,
						}}>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="var(--vscode-editorGroupHeader-tabsBorder, #555)"
						/>
						<XAxis
							dataKey="requestIndex"
							stroke="var(--vscode-descriptionForeground)" // Darker grey
							tick={{ fontSize: 10, fill: "var(--vscode-descriptionForeground)" }} // Darker grey for ticks
							// Removed: label={{ value: 'Request #', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: 'var(--vscode-foreground, #ccc)' }}
						/>
						<YAxis
							orientation="right" // Move Y-axis to the right
							stroke="var(--vscode-descriptionForeground)" // Darker grey
							tick={{ fontSize: 10, fill: "var(--vscode-descriptionForeground)" }} // Darker grey for ticks
							tickFormatter={formatYAxis}
							domain={["auto", "auto"]} // Adjust domain automatically
							allowDataOverflow={true}
							width={45} // Allocate space for Y-axis labels
						/>
						<Tooltip content={<CustomTooltip />} isAnimationActive={false} /> {/* Disable animation */}
						{/* Render a single line with customized dots for momentum */}
						<Line
							type="monotone"
							dataKey={dataKey} // Use dynamic dataKey based on viewMode
							stroke="var(--vscode-foreground)" // Use bright foreground color for the line
							strokeWidth={2}
							dot={false} // Keep dots disabled on the line itself
							activeDot={false}
							isAnimationActive={false}
						/>
						{/* Optional Threshold Line */}
						{costThreshold && (
							<ReferenceLine
								y={costThreshold}
								label={{
									value: `$${costThreshold.toFixed(2)} Threshold`,
									position: "insideTopRight",
									fontSize: 9,
									fill: "var(--vscode-charts-red, red)",
								}}
								stroke="var(--vscode-charts-red, red)"
								strokeDasharray="3 3"
							/>
						)}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	)
}

export default CostTrendChart
