import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState, FormEvent } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useDebounce } from "react-use"

interface RateLimitControlProps {
	value: number | undefined | null
	onChange: (value: number | undefined | null) => void
	maxValue?: number
}

export const RateLimitControl = ({ value, onChange, maxValue = 60 }: RateLimitControlProps) => {
	const { t } = useAppTranslation()
	const [isCustomRateLimit, setIsCustomRateLimit] = useState(value !== undefined)
	const [inputValue, setInputValue] = useState(value)
	useDebounce(() => onChange(inputValue), 50, [onChange, inputValue])
	// Sync internal state with prop changes when switching profiles
	useEffect(() => {
		const hasCustomRateLimit = value !== undefined && value !== null
		setIsCustomRateLimit(hasCustomRateLimit)
		setInputValue(value)
	}, [value])

	return (
		<>
			<div>
				<VSCodeCheckbox
					checked={isCustomRateLimit}
					onChange={(e: Event | FormEvent<HTMLElement>) => {
						const target = ("target" in e ? e.target : null) as HTMLInputElement | null
						if (!target) return
						const isChecked = target.checked
						setIsCustomRateLimit(isChecked)
						if (!isChecked) {
							setInputValue(null) // Unset the rate limit, note that undefined is unserializable
						} else {
							setInputValue(value ?? 0) // Use the value from apiConfiguration, if set
						}
					}}>
					<span className="font-medium">{t("settings:rateLimit.useCustom")}</span>
				</VSCodeCheckbox>
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:advanced.rateLimit.description")}
				</div>
			</div>

			{isCustomRateLimit && (
				<div
					style={{
						marginLeft: 0,
						paddingLeft: 10,
						borderLeft: "2px solid var(--vscode-button-background)",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
						<input
							type="range"
							min="0"
							max={maxValue}
							step="1"
							value={inputValue ?? 0}
							className="h-2 focus:outline-0 w-4/5 accent-vscode-button-background"
							onChange={(e) => setInputValue(parseInt(e.target.value))}
						/>
						<span>{inputValue}s</span>
					</div>
					<p className="text-vscode-descriptionForeground text-sm mt-1">
						{t("settings:advanced.rateLimit.description")}
					</p>
				</div>
			)}
		</>
	)
}
