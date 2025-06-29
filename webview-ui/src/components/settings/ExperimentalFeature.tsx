import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface ExperimentalFeatureProps {
	enabled: boolean
	onChange: (value: boolean) => void
	// Additional property to identify the experiment
	experimentKey?: string
}

export const ExperimentalFeature = ({ enabled, onChange, experimentKey }: ExperimentalFeatureProps) => {
	const { t } = useAppTranslation()

	// Generate translation keys based on experiment key
	const nameKey = experimentKey ? `settings:experimental.${experimentKey}.name` : ""
	const descriptionKey = experimentKey ? `settings:experimental.${experimentKey}.description` : ""

	return (
		<div className="flex flex-col gap-2">
			{" "}
			{/* Dodano flex-col i gap-2 */}
			<div className="flex items-center gap-2">
				<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
					<span className="font-medium">{t(nameKey)}</span>
				</VSCodeCheckbox>
			</div>
			<p className="text-vscode-descriptionForeground text-sm mt-0">{t(descriptionKey)}</p>
		</div>
	)
}
