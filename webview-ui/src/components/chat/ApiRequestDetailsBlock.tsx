import React from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/shared/safeJsonParse"
import { vscode } from "@src/utils/vscode"
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
		<div className="min-h-7 rounded py-2 px-3 items-center cursor-pointer select-none border bg-vscode-editor-background border-green-400/50 ">
			<div
				className="flex gap-4"
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
					<span className="codicon codicon-code text-vscode-descriptionForeground mr-2.5"></span>
				)}
				<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2">
					{t("chat:apiRequest.title") ?? " API Request"}
					{/* Optionally show cost if available and not failed/cancelled */}
					{cost !== null &&
						cost !== undefined &&
						cost > 0 &&
						!apiRequestFailedMessage &&
						!apiReqStreamingFailedMessage && (
							<span className="text-xs opacity-70 ml-2">${Number(cost || 0)?.toFixed(2)}</span>
						)}
				</span>
				<div className="flex-grow"></div>
				<span className={`codicon codicon-link-external`}></span>
			</div>
		</div>
	)
}

export default ApiRequestDetailsBlock
