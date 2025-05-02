import React, { useRef, useEffect, useMemo, useState } from "react"
import uPlot, { type Options, type AlignedData, sync } from "uplot"
import "uplot/dist/uPlot.min.css"
import { formatLargeNumber } from "@src/utils/format"

const GRID_SYNC = sync("cost-charts-grid")

type ChartData = AlignedData | undefined

interface CostTrendChartProps {
	chartData: ChartData
	onHoverChange: (hoverData: { isHovering: boolean; index?: number; yValue?: number } | null) => void
	onClick?: (event: MouseEvent) => void
	yAxisUnit?: string
	chartLabel?: string
	height?: number
	showXAxis?: boolean
	showYAxis?: boolean
	yAxisSide?: "left" | "right"
	axisFontSize?: string
	syncKey?: string
	hideYAxisZero?: boolean
	showGridLines?: boolean
	padding?: [number, number, number, number]
}

const getResolvedStyle = (variableName: string, fallback: string): string => {
	if (typeof window !== "undefined") {
		return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback
	}
	return fallback
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({
	chartData,
	onHoverChange,
	onClick,
	yAxisUnit = "$",
	chartLabel = "Value",
	height = 180,
	showXAxis = true,
	showYAxis = true,
	yAxisSide = "left",
	axisFontSize,
	syncKey,
	hideYAxisZero = false,
	showGridLines = true,
	padding = [10, 0, 0, 0],
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

		updateStyles()

		const observer = new MutationObserver((mutationsList) => {
			for (const mutation of mutationsList) {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					updateStyles()
					break
				}
			}
		})

		observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

		return () => observer.disconnect()
	}, [])

	const options = useMemo((): Options => {
		const clickPlugin = {
			hooks: {
				init: (u: uPlot) => {
					if (onClick) {
						const overElement = u.over
						const handleCaptureClick = (e: MouseEvent) => {
							if (e.detail === 1) {
								e.stopImmediatePropagation()
								onClick(e)
							}
						}
						overElement.addEventListener("click", handleCaptureClick, { capture: true })

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

		type PaddingTuple = [number, number, number, number]

		const dynamicPadding: PaddingTuple = yAxisSide === "right" ? [padding[0], 0, padding[2], padding[3]] : padding

		return {
			width: 400,
			height: effectiveHeight,
			padding: dynamicPadding,
			series: [
				{},
				{
					label: chartLabel,
					stroke: resolvedStyles.buttonForeground,
					width: showPointsOnly ? 0 : 2 / (window.devicePixelRatio || 1),
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
						stroke: resolvedStyles.tabsBorder, // Use grid color for ticks
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
						stroke: resolvedStyles.tabsBorder, // Use grid color for ticks
						width: 1 / (window.devicePixelRatio || 1),
						size: 10,
					},
					font: `${axisFontSize || resolvedStyles.fontSize} ${resolvedStyles.fontFamily}`,
					incrs: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
					space: showYAxis ? 30 : 0,
					values: showYAxis
						? (u: uPlot, ticks: number[]) =>
								ticks.map((rawValue: number) => {
									if (hideYAxisZero && rawValue === 0) {
										return ""
									}
									if (yAxisUnit === "$") {
										return `${yAxisUnit}${rawValue.toFixed(2)}`
									} else {
										return formatLargeNumber(rawValue)
									}
								})
						: undefined,
					size: showYAxis ? (yAxisSide === "right" ? 50 : 65) : 0,
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
				lock: false,
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
			plugins: [clickPlugin],
			hooks: {
				setCursor: [
					(u: uPlot) => {
						const { idx } = u.cursor
						if (idx != null) {
							const requestIndex = u.data[0]?.[idx]
							const yValue = u.data[1]?.[idx]
							if (typeof requestIndex === "number" && typeof yValue === "number") {
								onHoverChange({ isHovering: true, index: requestIndex, yValue: yValue })
							} else {
								onHoverChange({ isHovering: false })
							}
						} else {
							// Call hover change with false when idx is null (hover off)
							onHoverChange({ isHovering: false })
						}
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
	}, [
		resolvedStyles,
		onHoverChange,
		onClick,
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
		if (chartRef.current && chartData && chartData[0] && chartData[0].length > 0) {
			uplotInstanceRef.current?.destroy()

			try {
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
				uplotInstanceRef.current = null
			}
		} else if (uplotInstanceRef.current) {
			uplotInstanceRef.current.destroy()
			uplotInstanceRef.current = null
		}
	}, [options, chartData, onClick])

	useEffect(() => {
		const styleId = "uplot-custom-styles"
		document.getElementById(styleId)?.remove()

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
			     }
			     .u-legend .u-marker {
			       border-color: ${resolvedStyles.buttonForeground} !important;
			     }
			     .u-axis.u-right .u-label,
			     .u-axis.u-right .u-value,
			     .u-axis[data-side="1"] .u-label,
			     .u-axis[data-side="1"] .u-value,
			     .u-axis[data-side="1"] text {
			       text-align: right !important;
			     }
			     
			     .u-axis[data-side="1"] {
			     }
	     `
			document.head.appendChild(styleEl)
		}
	}, [resolvedStyles, chartData])

	if (!chartData || !chartData[0] || chartData[0].length === 0) {
		return (
			<div
				className="text-xs p-2 flex items-center justify-center"
				style={{
					height: `${options.height}px`,
					width: "100%",
					color: resolvedStyles.descriptionForeground,
				}}>
				No API requests made yet.
			</div>
		)
	}

	return (
		<div
			data-testid="cost-trend-chart-container" // Add test ID for specific selection
			ref={chartRef}
			style={{
				width: "100%",
				height: `${options.height}px`,
				position: "relative",
				padding: 0,
				margin: 0,
				overflow: "visible",
			}}
		/>
	)
}

export default CostTrendChart
