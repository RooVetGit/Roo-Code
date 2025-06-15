import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input, Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type DiagnosticsSettingsProps = HTMLAttributes<HTMLDivElement> & {
	includeDiagnostics?: boolean
	maxDiagnosticsCount?: number
	diagnosticsFilter?: string[]
	setCachedStateField: SetCachedStateField<"includeDiagnostics" | "maxDiagnosticsCount" | "diagnosticsFilter">
}

export const DiagnosticsSettings = ({
	includeDiagnostics,
	maxDiagnosticsCount,
	diagnosticsFilter,
	setCachedStateField,
	className,
	...props
}: DiagnosticsSettingsProps) => {
	const { t } = useAppTranslation()

	const handleFilterChange = (value: string) => {
		const filters = value
			.split(",")
			.map((f) => f.trim())
			.filter((f) => f.length > 0)
		setCachedStateField("diagnosticsFilter", filters)
	}

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader description={t("settings:diagnostics.description")}>
				<div className="flex items-center gap-2">
					<AlertCircle className="w-4" />
					<div>{t("settings:sections.diagnostics")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div>
					<VSCodeCheckbox
						checked={includeDiagnostics}
						onChange={(e: any) => setCachedStateField("includeDiagnostics", e.target.checked)}
						data-testid="include-diagnostics-checkbox">
						<label className="block font-medium mb-1">
							{t("settings:diagnostics.includeDiagnostics.label")}
						</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">
						{t("settings:diagnostics.includeDiagnostics.description")}
					</div>
				</div>

				{includeDiagnostics && (
					<div className="flex flex-col gap-4 pl-3 border-l-2 border-vscode-button-background">
						<div>
							<span className="block font-medium mb-1">
								{t("settings:diagnostics.maxDiagnosticsCount.label")}
							</span>
							<div className="flex items-center gap-2">
								<Slider
									min={0}
									max={200}
									step={1}
									value={[maxDiagnosticsCount ?? 50]}
									onValueChange={([value]) => setCachedStateField("maxDiagnosticsCount", value)}
									data-testid="max-diagnostics-count-slider"
								/>
								<span className="w-10">{maxDiagnosticsCount ?? 50}</span>
							</div>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:diagnostics.maxDiagnosticsCount.description")}
							</div>
						</div>

						<div>
							<span className="block font-medium mb-1">
								{t("settings:diagnostics.diagnosticsFilter.label")}
							</span>
							<Input
								type="text"
								className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded"
								value={diagnosticsFilter?.join(", ") || ""}
								onChange={(e) => handleFilterChange(e.target.value)}
								placeholder="e.g., dart Error, eslint/no-unused-vars"
								data-testid="diagnostics-filter-input"
							/>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:diagnostics.diagnosticsFilter.description")}
							</div>
						</div>
					</div>
				)}
			</Section>
		</div>
	)
}
