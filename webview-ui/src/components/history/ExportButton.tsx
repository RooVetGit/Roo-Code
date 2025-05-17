import { vscode } from "@/utils/vscode"
import { Button } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

export const ExportButton = ({ itemId, className }: { itemId: string; className?: string }) => {
	const { t } = useAppTranslation()

	return (
		<Button
			data-testid="export"
			variant="ghost"
			size="icon"
			className={className}
			title={t("history:exportTask")}
			onClick={(e) => {
				e.stopPropagation()
				vscode.postMessage({ type: "exportTaskWithId", text: itemId })
			}}>
			<span className="codicon codicon-desktop-download" style={{ fontSize: "16px", verticalAlign: "middle" }} />
		</Button>
	)
}
