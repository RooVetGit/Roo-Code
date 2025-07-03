import React from "react"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"

import { CodebaseIndexConfig, CodebaseIndexModels } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"

interface CodeIndexSettingsProps {
	codebaseIndexModels: CodebaseIndexModels | undefined
	codebaseIndexConfig: CodebaseIndexConfig | undefined
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({ codebaseIndexConfig }) => {
	const { t } = useAppTranslation()

	const handleToggleCodeIndex = (checked: boolean) => {
		vscode.postMessage({
			type: "codebaseIndexEnabled",
			isEnabled: checked,
		})
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start gap-2">
				<VSCodeCheckbox
					checked={codebaseIndexConfig?.codebaseIndexEnabled || false}
					onChange={(e: any) => handleToggleCodeIndex(e.target.checked)}>
					{t("settings:codeIndex.enableLabel")}
				</VSCodeCheckbox>
			</div>
			<p className="text-sm text-vscode-descriptionForeground ml-6">
				<Trans i18nKey="settings:codeIndex.enableDescription">
					<VSCodeLink
						href={buildDocLink("features/experimental/codebase-indexing", "settings")}
						style={{ display: "inline" }}></VSCodeLink>
				</Trans>
			</p>
		</div>
	)
}
