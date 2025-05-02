import React, { useState, useCallback, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import CostTrendChart from "./CostTrendChart"
import {} from "@src/components/ui"

interface CostHistoryDataPoint {
	requestIndex: number
	cumulativeCost: number
	costDelta: number
	tokensIn?: number
	tokensOut?: number
	cacheReads?: number
	cacheWrites?: number
}

interface TaskCostChartSectionProps {
	costHistory?: CostHistoryDataPoint[]
}

export type ChartType = "costDelta" | "cumulativeCost" | "tokensIn" | "tokensOut" | "gridView"

const TaskCostChartSection: React.FC<TaskCostChartSectionProps> = ({ costHistory }) => {
	const { t } = useTranslation()
	const [selectedChartType, setSelectedChartType] = useState<ChartType>("gridView")
	const [_activelyHoveredChartType, setActivelyHoveredChartType] = useState<ChartType | null>(null)
	const [chartHoverData, setChartHoverData] = useState<{
		isHovering: boolean
		index?: number
		value?: number
		type?: ChartType
	} | null>(null)
	const gridContainerRef = useRef<HTMLDivElement>(null)

	const handleChartHoverChange = useCallback(
		(
			hoverData: { isHovering: boolean; index?: number; yValue?: number } | null,
			type: ChartType = selectedChartType,
		) => {
			setChartHoverData((prevData) => {
				if (!hoverData?.isHovering && !prevData) return prevData

				if (!hoverData?.isHovering) return null

				const newData = {
					isHovering: true,
					index: hoverData.index,
					value: hoverData.yValue,
					type: type,
				}

				if (selectedChartType === "gridView") {
					return newData
				} else {
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
		[selectedChartType],
	)

	const typeSpecificHoverHandlers = useMemo(() => {
		const handlers: Record<ChartType, (d: any) => void> = {
			costDelta: (d) => handleChartHoverChange(d, "costDelta"),
			cumulativeCost: (d) => handleChartHoverChange(d, "cumulativeCost"),
			tokensIn: (d) => handleChartHoverChange(d, "tokensIn"),
			tokensOut: (d) => handleChartHoverChange(d, "tokensOut"),
			gridView: (d) => handleChartHoverChange(d, "gridView"),
		}
		return handlers
	}, [handleChartHoverChange])

	const getChartTitle = (type: ChartType): string => {
		switch (type) {
			case "cumulativeCost":
				return t("chat:task.totalCostChartTitle", "Total Cost")
			case "tokensIn":
				return t("chat:task.tokensInChartTitle", "Input Tokens")
			case "tokensOut":
				return t("chat:task.tokensOutChartTitle", "Output Tokens")
			case "costDelta":
			default:
				return t("chat:task.requestCostChartTitle", "Request Cost")
		}
	}

	const getSingleChartTitle = (type: ChartType): string => {
		switch (type) {
			case "cumulativeCost":
				return t("chat:task.totalCostChartTitle", "Total Cost:")
			case "tokensIn":
				return t("chat:task.tokensInChartTitle", "Input Tokens:")
			case "tokensOut":
				return t("chat:task.tokensOutChartTitle", "Output Tokens:")
			case "costDelta":
			default:
				return t("chat:task.requestCostChartTitle", "Request Cost:")
		}
	}

	const formatHoverValue = (type: ChartType, value: number): string => {
		switch (type) {
			case "cumulativeCost":
			case "costDelta":
				return value < 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`
			case "tokensIn":
			case "tokensOut":
				return `${value.toLocaleString()} ${t("chat:task.tokensUnit", "tokens")}`
			default:
				return String(value)
		}
	}

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
			return [requestIndices, getDataForType(selectedChartType)]
		}
	}, [costHistory, selectedChartType])

	const handleSingleChartClick = useCallback(() => {
		setSelectedChartType("gridView")
		setChartHoverData(null)
	}, [])

	const handleMouseLeaveSection = useCallback(() => {
		setChartHoverData(null)
	}, [])

	if (!costHistory) {
		return null
	}

	const displayTitle =
		selectedChartType === "gridView"
			? t("chat:task.costOverviewTitle", "Cost Overview")
			: getSingleChartTitle(selectedChartType)

	return (
		<div className="flex flex-col" onMouseLeave={handleMouseLeaveSection}>
			{selectedChartType !== "gridView" && (
				<div className="flex items-center h-[24px] mb-2">
					{" "}
					<div className="flex items-center gap-1 flex-grow min-w-0">
						{" "}
						<span className="font-bold whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0">
							{" "}
							{displayTitle}
						</span>
						{chartHoverData?.isHovering &&
							chartHoverData.index !== undefined &&
							chartHoverData.value !== undefined &&
							chartHoverData.type !== undefined && (
								<span className="truncate flex-shrink-0 ml-1 text-vscode-descriptionForeground">
									{" "}
									{`${t("chat:task.requestShort", "Request {{index}}:", { index: chartHoverData.index })} ${formatHoverValue(chartHoverData.type, chartHoverData.value)}`}
								</span>
							)}
					</div>
				</div>
			)}

			{selectedChartType === "gridView" ? (
				<div ref={gridContainerRef} className="grid grid-cols-2 gap-0">
					{" "}
					{(["costDelta", "cumulativeCost", "tokensIn", "tokensOut"] as ChartType[]).map((type) => {
						const chartData = (preparedChartData as Record<ChartType, [number[], number[]]>)[type]
						const yAxisUnit = type === "costDelta" || type === "cumulativeCost" ? "$" : ""
						const chartHeight = 60

						const isTopLeft = type === "costDelta"
						const isTopRight = type === "cumulativeCost"
						const isBottomLeft = type === "tokensIn"
						const isBottomRight = type === "tokensOut"

						const borderClasses = [
							isTopLeft || isBottomLeft ? "border-r border-vscode-panel-border" : "",
							isTopLeft || isTopRight ? "border-b border-vscode-panel-border" : "",
						]
							.join(" ")
							.trim()

						let hoverValueDisplay = ""
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
								const requestText = `: ${chartHoverData.index}`
								hoverValueDisplay = `${formatHoverValue(type, value)} ${requestText}`
							}
						}

						return (
							<div
								key={type}
								className={`flex flex-col ${borderClasses} cursor-pointer`}
								onClick={() => {
									setSelectedChartType(type)
									setChartHoverData(null)
									setActivelyHoveredChartType(null)
								}}
								title={t("chat:task.clickToEnlarge", "Click to enlarge")}
								onMouseEnter={() => setActivelyHoveredChartType(type)}
								onMouseLeave={() => setActivelyHoveredChartType(null)}>
								<div
									className={`h-[24px] mb-1 flex items-center justify-between min-w-0 ${isTopRight || isBottomRight ? "pl-2.5" : "pl-0"} ${isTopLeft || isBottomLeft ? "pr-2.5" : ""}`}>
									<div className="flex items-center overflow-hidden min-w-0 flex-shrink mr-1">
										<span className="font-bold text-vscode-descriptionForeground whitespace-nowrap truncate">
											{getChartTitle(type)}
										</span>
									</div>
									<div className="flex items-center overflow-hidden min-w-0 flex-shrink-0 ml-1">
										{hoverValueDisplay ? (
											<span className="truncate text-vscode-descriptionForeground">
												{hoverValueDisplay}
											</span>
										) : (
											<span>&nbsp;</span>
										)}
									</div>
								</div>{" "}
								<CostTrendChart
									chartData={chartData}
									onHoverChange={typeSpecificHoverHandlers[type]}
									yAxisUnit={yAxisUnit}
									chartLabel={getChartTitle(type)}
									height={chartHeight}
									showXAxis={false}
									showYAxis={false}
									axisFontSize="11px"
									hideYAxisZero={true}
									showGridLines={true}
									padding={[
										0,
										isTopLeft || isBottomLeft ? 10 : 5,
										5,
										isTopRight || isBottomRight ? 10 : 0,
									]}
									syncKey="grid"
								/>
							</div>
						)
					})}
				</div>
			) : (
				<div
					className="cursor-pointer w-full p-0 m-0"
					title={t("chat:task.clickToGoBack", "Click to go back to grid view")}>
					<CostTrendChart
						chartData={preparedChartData as [number[], number[]]}
						onHoverChange={typeSpecificHoverHandlers[selectedChartType]}
						onClick={handleSingleChartClick}
						height={145}
						yAxisUnit={
							selectedChartType === "costDelta" || selectedChartType === "cumulativeCost" ? "$" : ""
						}
						chartLabel={getChartTitle(selectedChartType)}
						yAxisSide="right"
						padding={[0, 0, 0, 0]}
					/>
				</div>
			)}
		</div>
	)
}

export default TaskCostChartSection
