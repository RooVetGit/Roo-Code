import React from "react"
import { useTranslation } from "react-i18next"
import { Package } from "@roo/package"

interface VersionIndicatorProps {
	onClick: () => void
	className?: string
	// When true, renders a small "NEW" badge over the version button
	showBadge?: boolean
}

const VersionIndicator: React.FC<VersionIndicatorProps> = ({ onClick, className = "", showBadge = false }) => {
	const { t } = useTranslation()

	return (
		<button
			onClick={onClick}
			className={`relative inline-flex items-center text-xs text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors cursor-pointer px-2 py-1 rounded border ${className}`}
			aria-label={t("chat:versionIndicator.ariaLabel", { version: Package.version })}>
			v{Package.version}
			{showBadge && (
				<span
					// The badge uses VS Code theme variables to blend with light/dark themes
					className="absolute -top-1.5 -right-1.5 rounded-full bg-vscode-button-background text-vscode-button-foreground text-[10px] leading-none px-1.5 py-0.5 shadow ring-2 ring-vscode-editor-background select-none">
					NEW
				</span>
			)}
		</button>
	)
}

export default VersionIndicator
