import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { FormEvent } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

const McpEnabledToggle = () => {
	const { t } = useAppTranslation()
	const { mcpEnabled, setMcpEnabled } = useExtensionState()

	const handleChange = (e: Event | FormEvent<HTMLElement>) => {
		const target = ("target" in e ? e.target : null) as HTMLInputElement | null
		if (!target) return
		setMcpEnabled(target.checked)
		vscode.postMessage({ type: "mcpEnabled", bool: target.checked })
	}

	return (
		<div style={{ marginBottom: "20px" }}>
			<VSCodeCheckbox checked={mcpEnabled} onChange={handleChange}>
				<span style={{ fontWeight: "500" }}>{t("mcp:enableMcpServers")}</span>
			</VSCodeCheckbox>
			<p
				style={{
					fontSize: "12px",
					marginTop: "5px",
					color: "var(--vscode-descriptionForeground)",
				}}>
				{t("mcp:mcpEnabledDescription")}
			</p>
		</div>
	)
}

export default McpEnabledToggle
