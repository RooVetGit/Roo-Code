import { memo } from "react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"

const HistoryPreview = () => {
	const { tasks } = useTaskSearch()
	const { t } = useAppTranslation()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	return (
		<div className="flex flex-col gap-3">
			{tasks.length !== 0 && (
				<>
					{tasks.slice(0, 3).map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
					<button
						onClick={handleViewAllHistory}
						className="text-xs text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer text-left flex items-center gap-1 mt-1"
						aria-label={t("history:viewAllHistory")}>
						<span>{t("history:viewAllHistory")}</span>
						<span className="codicon codicon-arrow-right text-xs" />
					</button>
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
