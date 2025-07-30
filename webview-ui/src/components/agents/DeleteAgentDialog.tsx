import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@src/components/ui"

interface DeleteAgentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	modeToDelete: {
		slug: string
		name: string
		source?: string
		rulesFolderPath?: string
	} | null
	onConfirm: () => void
}

export const DeleteAgentDialog: React.FC<DeleteAgentDialogProps> = ({
	open,
	onOpenChange,
	modeToDelete,
	onConfirm,
}) => {
	const { t } = useAppTranslation()

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("prompts:deleteAgent.title")}</AlertDialogTitle>
					<AlertDialogDescription>
						{modeToDelete && (
							<>
								{t("prompts:deleteAgent.message", { modeName: modeToDelete.name })}
								{modeToDelete.rulesFolderPath && (
									<div className="mt-2">
										{t("prompts:deleteAgent.rulesFolder", {
											folderPath: modeToDelete.rulesFolderPath,
										})}
									</div>
								)}
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("prompts:deleteAgent.cancel")}</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>{t("prompts:deleteAgent.confirm")}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
