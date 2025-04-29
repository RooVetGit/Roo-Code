import React from "react"
import {
	LineChart,
	Line,
	ResponsiveContainer,
	YAxis, // Import YAxis
} from "recharts"
import type { CostViewMode } from "./TaskHeader" // Import the type

// Define the structure of the data points we expect
interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
}

interface CostSparklineProps {
	data: CostHistoryDataPoint[]
	width?: number
	height?: number
	viewMode: CostViewMode // Add viewMode prop
}

const CostSparkline: React.FC<CostSparklineProps> = ({
	data,
	width = 50,
	height = 20,
	viewMode, // Use prop
}) => {
	if (!data || data.length < 2) {
		// Need at least 2 points for a line
		return (
			<div
				style={{ width, height }}
				className="flex items-center justify-center text-xs text-vscode-descriptionForeground opacity-50">
				--
			</div>
		)
	}

	return (
		<div style={{ width, height }}>
			<ResponsiveContainer>
				<LineChart
					data={data}
					margin={{ top: 2, right: 2, left: 2, bottom: 2 }} // Minimal margins
					// Set Y-axis domain to start at 0
					syncId="costSparklineSync" // Added syncId in case we need multiple sparklines later
				>
					{/* Define a hidden YAxis to control the domain, ensure it starts at 0 */}
					<YAxis type="number" domain={[0, "auto"]} hide={true} yAxisId="left" allowDataOverflow={true} />
					{/* Render a single line with customized dots for momentum */}
					<Line
						yAxisId="left" // Associate line with the defined YAxis
						type="monotone"
						// Dynamically set dataKey based on viewMode
						dataKey={viewMode === "cumulative" ? "cumulativeCost" : "costDelta"}
						stroke="var(--vscode-foreground)" // Use default foreground color
						strokeWidth={1.5} // Slightly thinner line
						dot={false} // Disable dots
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	)
}

export default CostSparkline
