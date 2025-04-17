import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { NotebookText } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type NotebookSettingsProps = HTMLAttributes<HTMLDivElement> & {
	notebookMaxOutputSize?: number
	notebookTimeoutSeconds?: number
	setCachedStateField: SetCachedStateField<"notebookMaxOutputSize" | "notebookTimeoutSeconds">
}

// Min/max ranges for the sliders
const SIZE_MIN = 100
const SIZE_MAX = 500000
const TIME_MIN = 5
const TIME_MAX = 72000

// Typical size values for the notebook max output size
const TYPICAL_SIZE_VALUES = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]

// Typical time values in seconds
const TYPICAL_TIME_VALUES = [
	5,
	10,
	15,
	30, // Seconds
	60,
	5 * 60,
	10 * 60,
	15 * 60,
	30 * 60, // Minutes (1m, 5m, 10m, 15m, 30m)
	3600,
	2 * 3600,
	6 * 3600,
	12 * 3600,
	24 * 3600,
	72 * 3600, // Hours (1h, 2h, 6h, 12h, 24h, 72h)
]

// Format size to K notation when over 1000
const formatSize = (size: number): string => {
	return size >= 1000 ? `${(size / 1000).toFixed(1)}K` : `${size}`
}

// Format seconds to minutes or HH:MM when over 60 seconds
const formatTime = (seconds: number): string => {
	if (seconds < 60) return `${seconds}s`

	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)

	if (hours > 0) {
		return `${hours.toString().padStart(2, "0")}h${minutes.toString().padStart(2, "0")}m`
	}

	return `${minutes}m`
}

// Get logarithmic value for better sliding on large ranges
const toLogScale = (value: number, min: number, max: number): number => {
	// Convert from linear to logarithmic scale
	const minLog = Math.log(min)
	const maxLog = Math.log(max)
	const scale = (maxLog - minLog) / (max - min)
	return Math.exp(minLog + scale * (value - min))
}

// Convert from logarithmic to linear scale for the slider
const fromLogScale = (value: number, min: number, max: number): number => {
	const minLog = Math.log(min)
	const maxLog = Math.log(max)
	const scale = (maxLog - minLog) / (max - min)
	return (Math.log(value) - minLog) / scale + min
}

// Find the closest typical value to snap to
const findClosestTypicalValue = (value: number, typicalValues: number[], threshold = 0.15): number => {
	// Find the closest typical value
	let closest = typicalValues[0]
	let minDiff = Math.abs(value - closest)

	for (const typical of typicalValues) {
		const diff = Math.abs(value - typical)
		if (diff < minDiff) {
			minDiff = diff
			closest = typical
		}
	}

	// Calculate the relative distance as a percentage of the value
	const relativeDistance = minDiff / value

	// Only snap if we're close enough (within threshold %)
	return relativeDistance <= threshold ? closest : value
}

export const NotebookSettings = ({
	notebookMaxOutputSize,
	notebookTimeoutSeconds,
	setCachedStateField,
	className,
	...props
}: NotebookSettingsProps) => {
	const { t } = useAppTranslation()

	const sizeValue = notebookMaxOutputSize ?? 2000
	const timeValue = notebookTimeoutSeconds ?? 30

	// Convert to log scale for better slider UX
	const sizeLogValue = fromLogScale(sizeValue, SIZE_MIN, SIZE_MAX)
	const timeLogValue = fromLogScale(timeValue, TIME_MIN, TIME_MAX)

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<NotebookText className="w-4" />
					<div>{t("settings:sections.notebook")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<label className="block font-medium mb-1">{t("settings:notebook.maxOutputSize.label")}</label>
					<div className="flex items-center gap-2">
						<Slider
							min={SIZE_MIN}
							max={SIZE_MAX}
							step={1}
							value={[sizeLogValue]}
							onValueChange={([value]) => {
								// Convert from log scale to actual value
								let actualValue = Math.round(toLogScale(value, SIZE_MIN, SIZE_MAX))
								// Snap to typical values if close enough
								actualValue = findClosestTypicalValue(actualValue, TYPICAL_SIZE_VALUES)
								setCachedStateField("notebookMaxOutputSize", actualValue)
							}}
							data-testid="notebook-output-size-slider"
						/>
						<span className="w-12">{formatSize(sizeValue)}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notebook.maxOutputSize.description")}
					</div>
				</div>

				<div>
					<label className="block font-medium mb-1">{t("settings:notebook.timeoutSeconds.label")}</label>
					<div className="flex items-center gap-2">
						<Slider
							min={TIME_MIN}
							max={TIME_MAX}
							step={1}
							value={[timeLogValue]}
							onValueChange={([value]) => {
								// Convert from log scale to actual value
								let actualValue = Math.round(toLogScale(value, TIME_MIN, TIME_MAX))
								// Snap to typical values if close enough
								actualValue = findClosestTypicalValue(actualValue, TYPICAL_TIME_VALUES)
								// Ensure value is within bounds
								actualValue = Math.min(TIME_MAX, Math.max(TIME_MIN, actualValue))
								setCachedStateField("notebookTimeoutSeconds", actualValue)
							}}
						/>
						<span className="w-12">{formatTime(timeValue)}</span>
					</div>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:notebook.timeoutSeconds.description")}
					</div>
				</div>
			</Section>
		</div>
	)
}
