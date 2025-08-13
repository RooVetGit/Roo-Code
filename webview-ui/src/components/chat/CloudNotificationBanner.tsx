import { useTranslation } from "react-i18next"
import { Lightbulb, X } from "lucide-react"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"

interface CloudNotificationBannerProps {
	onDismiss: () => void
	className?: string
}

export const CloudNotificationBanner = ({ onDismiss, className }: CloudNotificationBannerProps) => {
	const { t } = useTranslation()

	const handleDismiss = () => {
		onDismiss()
	}

	const handleNavigate = () => {
		vscode.postMessage({ type: "switchTab", tab: "account" })
		handleDismiss()
	}

	return (
		<div
			className={cn("bg-vscode-badge-background relative z-50", className)}
			data-testid="cloud-notification-banner">
			{/* Main notification container with speech bubble */}
			<div
				className="relative text-vscode-badge-foreground p-2 rounded-md cursor-pointer transition-colors"
				onClick={handleNavigate}
				data-testid="navigate-button">
				{/* Speech bubble triangle */}
				<div
					className="absolute bg-vscode-badge-background w-3 h-1.5"
					style={{
						clipPath: "polygon(50% 0,100% 100%,0 100%)",
						top: "-6px",
						right: "15px",
					}}
				/>

				{/* Content */}
				<div className="flex items-center justify-between gap-2">
					<Lightbulb size={30} />
					<span className="text-xs">{t("chat:cloudNotification.message")}</span>

					{/* Close button */}
					<button
						onClick={(e) => {
							e.stopPropagation()
							handleDismiss()
						}}
						className="cursor-pointer"
						aria-label="Close notification"
						data-testid="dismiss-button">
						<X size={14} className="text-vscode-badge-foreground" />
					</button>
				</div>
			</div>
		</div>
	)
}
