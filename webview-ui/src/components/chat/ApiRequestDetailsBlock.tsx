import React from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/shared/safeJsonParse"
import { vscode } from "@src/utils/vscode"
import { CODE_BLOCK_BG_COLOR } from "../common/CodeBlock" // Assuming CodeBlock is in ../common
import { ClineApiReqInfo, ClineMessage } from "@roo/shared/ExtensionMessage"

interface ApiRequestDetailsBlockProps {
	message: ClineMessage
	icon: React.ReactNode
	cost: number | undefined
	apiRequestFailedMessage: string | undefined
	apiReqStreamingFailedMessage: string | undefined
}

const ApiRequestDetailsBlock: React.FC<ApiRequestDetailsBlockProps> = ({
	message,
	icon,
	cost,
	apiRequestFailedMessage,
	apiReqStreamingFailedMessage,
}) => {
	const { t } = useTranslation()

	return (
		<div
			style={{
				backgroundColor: CODE_BLOCK_BG_COLOR,
				overflow: "hidden",
				border: "1px solid var(--vscode-editorGroup-border)",
				marginTop: apiRequestFailedMessage || apiReqStreamingFailedMessage ? 0 : 10, // Add margin if no error shown above
			}}>
			<div
				className="border border-green-400 rounded p-2"
				style={{
					color: "var(--vscode-descriptionForeground)",
					display: "flex",
					alignItems: "center",
					padding: "9px 10px",
					cursor: "pointer",
					userSelect: "none",
					WebkitUserSelect: "none",
					MozUserSelect: "none",
					msUserSelect: "none",
				}}
				onClick={() => {
					const apiInfo = safeJsonParse<ClineApiReqInfo>(message.text)
					if (apiInfo?.request) {
						vscode.postMessage({
							type: "showApiRequestDetails",
							details: apiInfo.request,
						})
					}
				}}
				title={t("chat:apiRequest.viewDetailsTooltip") ?? "View API Request Details"}>
				{/* Use a generic icon or the original one if no error */}
				{!apiRequestFailedMessage && !apiReqStreamingFailedMessage ? (
					icon // Use original icon (spinner, check, error)
				) : (
					<span
						className="codicon codicon-code"
						style={{
							color: "var(--vscode-descriptionForeground)",
							marginRight: "10px",
						}}></span>
				)}
				<span
					style={{
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						marginRight: "8px",
						color: "var(--vscode-foreground)", // Use standard foreground color
					}}>
					{t("chat:apiRequest.title") ?? " API Request"}
					{/* Optionally show cost if available and not failed/cancelled */}
					{cost !== null &&
						cost !== undefined &&
						cost > 0 &&
						!apiRequestFailedMessage &&
						!apiReqStreamingFailedMessage && (
							<span style={{ opacity: 0.7, marginLeft: "8px" }}>(${Number(cost || 0)?.toFixed(4)})</span>
						)}
				</span>
				<div style={{ flexGrow: 1 }}></div>
				<span className={`codicon codicon-link-external`} style={{ fontSize: 13.5, margin: "1px 0" }}></span>
			</div>
		</div>
	)
}

export default ApiRequestDetailsBlock
