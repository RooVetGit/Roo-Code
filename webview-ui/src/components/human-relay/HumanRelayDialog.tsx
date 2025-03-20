import * as React from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Textarea } from "../ui/textarea"
import { useClipboard } from "../ui/hooks"
import { AlertTriangle, Check, Copy, Power, X } from "lucide-react"
import { useState as useReactState } from "react"
import { vscode } from "../../utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface HumanRelayDialogProps {
	isOpen: boolean
	onClose: () => void
	requestId: string
	promptText: string
	onSubmit: (requestId: string, text: string) => void
	onCancel: (requestId: string) => void
	monitorClipboard?: boolean
	monitorInterval?: number
	onToggleMonitor?: (enabled: boolean) => void
}

/**
 * Human Relay Dialog Component
 * Displays the prompt text that needs to be copied and provides an input box for the user to paste the AI's response.
 */
export const HumanRelayDialog: React.FC<HumanRelayDialogProps> = ({
	isOpen,
	onClose,
	requestId,
	promptText,
	onSubmit,
	onCancel,
	monitorClipboard = false,
	monitorInterval = 500,
	onToggleMonitor,
}) => {
	const { t } = useAppTranslation()
	const [response, setResponse] = React.useState("")
	const { copy } = useClipboard()
	const [isCopyClicked, setIsCopyClicked] = React.useState(false)
	const [showDuplicateWarning, setShowDuplicateWarning] = React.useState(false)
	const [warningMessage, setWarningMessage] = React.useState("")
	const [isMonitoring, setIsMonitoring] = useReactState(monitorClipboard)

	// Clear input when dialog opens
	React.useEffect(() => {
		if (isOpen) {
			setResponse("")
			setIsCopyClicked(false)
			setIsMonitoring(monitorClipboard)
		}
		setShowDuplicateWarning(false)
	}, [isOpen, monitorClipboard, setIsMonitoring])

	// Handle monitor toggle
	const handleToggleMonitor = () => {
		const newState = !isMonitoring
		setIsMonitoring(newState)

		// Send message to backend to control clipboard monitoring
		vscode.postMessage({
			type: "toggleHumanRelayMonitor",
			bool: newState,
			requestId: requestId,
		})

		if (onToggleMonitor) {
			onToggleMonitor(newState)
		}
	}

	React.useEffect(() => {
		// Handle messages from extension
		const messageHandler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "closeHumanRelayDialog") {
				onClose()
			}
			// Handle duplicate response warning
			else if (message.type === "showHumanRelayResponseAlert") {
				if (message.requestId === "lastInteraction") setWarningMessage(t("humanRelay:warning.lastInteraction"))
				else if (message.requestId === "invalidResponse")
					setWarningMessage(t("humanRelay:warning.invalidResponse"))
				setShowDuplicateWarning(true)
			}
		}

		window.addEventListener("message", messageHandler)

		return () => {
			window.removeEventListener("message", messageHandler)
		}
	}, [onClose, t])

	// Copy to clipboard and show success message
	const handleCopy = () => {
		copy(promptText)
		setIsCopyClicked(true)
		setTimeout(() => {
			setIsCopyClicked(false)
		}, 2000)
	}

	// Submit response
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (response.trim()) {
			onSubmit(requestId, response)
			onClose()
		}
	}

	// Cancel operation
	const handleCancel = () => {
		onCancel(requestId)
		onClose()
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
			<DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>{t("humanRelay:dialogTitle")}</DialogTitle>
					<DialogDescription>{t("humanRelay:dialogDescription")}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-6 py-6">
					<div className="relative">
						<Textarea
							className="min-h-[200px] font-mono text-sm p-4 pr-12 whitespace-pre-wrap"
							value={promptText}
							readOnly
						/>
						<Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={handleCopy}>
							{isCopyClicked ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
						</Button>
					</div>

					{isCopyClicked && (
						<div className="text-sm text-emerald-500 font-medium">{t("humanRelay:copiedToClipboard")}</div>
					)}
					{showDuplicateWarning && (
						<div className="flex items-center gap-2 text-sm p-2 rounded-md bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
							<AlertTriangle className="h-4 w-4 text-amber-500" />
							<span className="font-medium">{warningMessage}</span>
						</div>
					)}

					<div className="flex items-center justify-between text-sm text-vscode-descriptionForeground">
						<div className="flex items-center gap-2">
							{isMonitoring && <ProgressIndicator />}
							<span>
								{t("humanRelay:clipboardMonitoring.label")}{" "}
								{isMonitoring
									? t("humanRelay:clipboardMonitoring.enabled")
									: t("humanRelay:clipboardMonitoring.disabled")}
							</span>
						</div>
						<Button
							size="sm"
							variant={isMonitoring ? "outline" : "default"}
							onClick={handleToggleMonitor}
							className="gap-1 ml-2">
							<Power className="h-4 w-4" />
							{isMonitoring
								? t("humanRelay:clipboardMonitoring.disable")
								: t("humanRelay:clipboardMonitoring.enable")}
						</Button>
					</div>

					<div className="text-sm text-vscode-descriptionForeground mt-2">
						{t("humanRelay:shortcutDescription")}
					</div>

					<div>
						<div className="mb-2 font-medium">{t("humanRelay:aiResponse.label")}</div>
						<Textarea
							placeholder={t("humanRelay:aiResponse.placeholder")}
							value={response}
							onChange={(e) => setResponse(e.target.value)}
							className="min-h-[150px]"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel} className="gap-1">
						<X className="h-4 w-4" />
						{t("humanRelay:actions.cancel")}
					</Button>
					<Button onClick={handleSubmit} disabled={!response.trim()} className="gap-1">
						<Check className="h-4 w-4" />
						{t("humanRelay:actions.submit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
const ProgressIndicator = () => (
	<div
		style={{
			width: "16px",
			height: "16px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		}}>
		<div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
			<VSCodeProgressRing />
		</div>
	</div>
)
