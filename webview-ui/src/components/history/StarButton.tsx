import React from "react"
import { cn } from "@/lib/utils"
import { StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface StarButtonProps {
	itemId: string
	isStarred?: boolean
	onToggleStar: (itemId: string) => void
	className?: string
}

export const StarButton: React.FC<StarButtonProps> = ({ itemId, isStarred, onToggleStar, className }) => {
	const { t } = useAppTranslation()

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		onToggleStar(itemId)
	}

	return (
		<StandardTooltip content={isStarred ? t("history:unstarTask") : t("history:starTask")}>
			<button
				onClick={handleClick}
				className={cn(
					"p-1 rounded hover:bg-vscode-toolbar-hoverBackground transition-colors",
					"focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder",
					className,
				)}
				aria-label={isStarred ? t("history:unstarTask") : t("history:starTask")}>
				<span
					className={cn("codicon", {
						"codicon-star-full text-vscode-notificationsWarningIcon-foreground": isStarred,
						"codicon-star-empty": !isStarred,
					})}
				/>
			</button>
		</StandardTooltip>
	)
}
