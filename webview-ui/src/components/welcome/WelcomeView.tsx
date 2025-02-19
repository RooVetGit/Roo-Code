import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import { Trans } from "react-i18next"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName } = useExtensionState()

	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = () => {
		const error = validateApiConfiguration(apiConfiguration)
		if (error) {
			setErrorMessage(error)
			return
		}
		setErrorMessage(undefined)
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName,
			apiConfiguration,
		})
	}

	return (
		<div className="flex flex-col min-h-screen px-0 pb-5">
			<h2>
				<Trans i18nKey="hiImRoo">Hi, I'm Roo!</Trans>
			</h2>
			<p>
				<Trans i18nKey="taskDescription"></Trans>
			</p>

			<b>
				<Trans i18nKey="apiProviderNeeded"></Trans>
			</b>

			<div className="mt-3">
				<ApiOptions fromWelcomeView />
			</div>

			<div className="sticky bottom-0 bg-[var(--vscode-editor-background)] py-3">
				<div className="flex flex-col gap-1.5">
					<VSCodeButton onClick={handleSubmit}>
						<Trans i18nKey="letsGoButton">Let's go!</Trans>
					</VSCodeButton>
					{errorMessage && <span className="text-destructive">{errorMessage}</span>}
				</div>
			</div>
		</div>
	)
}

export default WelcomeView
