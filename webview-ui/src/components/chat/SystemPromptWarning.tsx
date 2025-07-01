import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"

export const SystemPromptWarning: React.FC = () => {
	const { t } = useAppTranslation()
	const { setSystemPromptWarningDismissed } = useExtensionState()

	const handleDismiss = () => {
		setSystemPromptWarningDismissed(true)
	}

	return (
		<div className="flex items-center px-4 py-2 mb-2 text-sm rounded bg-vscode-editorWarning-foreground text-vscode-editor-background">
			<div className="flex items-center justify-center w-5 h-5 mr-2">
				<span className="codicon codicon-warning" />
			</div>
			<span className="flex-1">{t("chat:systemPromptWarning")}</span>
			<button
				onClick={handleDismiss}
				className="flex items-center justify-center w-5 h-5 ml-2 hover:bg-vscode-editor-background hover:bg-opacity-20 rounded"
				title="Dismiss warning">
				<span className="codicon codicon-close" />
			</button>
		</div>
	)
}

export default SystemPromptWarning
