import { useCallback } from "react"
import { useTranslation, Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { buildDocLink } from "../../utils/docLinks"
import { vscode } from "@/utils/vscode"

export const CommandExecutionError = () => {
	const { t } = useTranslation()

	const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault()
		window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "terminal" } }, "*")
	}, [])

	return (
		<div className="text-sm bg-vscode-editor-background border border-vscode-border rounded-xs p-2">
			<div className="flex flex-col gap-2">
				<div className="flex items-center">
					<i className="codicon codicon-warning mr-1 text-vscode-editorWarning-foreground" />
					<span className="text-vscode-editorWarning-foreground font-medium">
						{t("chat:shellIntegration.title")}
					</span>
				</div>
				<div>
					<Trans
						i18nKey="chat:shellIntegration.description"
						components={{
							settingsLink: <VSCodeLink href="#" onClick={onClick} className="inline" />,
						}}
					/>
				</div>
				<a
					href={buildDocLink("troubleshooting/shell-integration/", "error_tooltip")}
					className="underline"
					style={{ color: "inherit" }}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => {
						const url = buildDocLink("troubleshooting/shell-integration/", "error_tooltip")
						const event = "docs_link_clicked"
						const properties = { campaign: "error_tooltip", page: "/troubleshooting/shell-integration/" }
						// TEMP LOGGING: UTM Telemetry Event
						// eslint-disable-next-line no-console
						console.log(
							"%c[Telemetry]%c Event: %c%s%c | Properties: %c%o%c | URL: %c%s",
							"background: #222; color: #fff; padding:2px 4px; border-radius:2px;",
							"",
							"color: #4FC3F7; font-weight:bold;",
							event,
							"",
							"color: #81C784;",
							properties,
							"",
							"color: #FFD54F;",
							url,
						)
						vscode.postMessage({
							type: "telemetry",
							event,
							properties,
						} as any)
					}}>
					{t("chat:shellIntegration.troubleshooting")}
				</a>
			</div>
		</div>
	)
}
