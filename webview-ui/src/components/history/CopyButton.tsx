import { useCallback, useState } from "react"

import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

type CopyButtonProps = {
	itemId: string
}

export const CopyButton = ({ itemId }: CopyButtonProps) => {
	const [isCopied, setIsCopied] = useState(false)
	const { t } = useAppTranslation()

	const onCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()

			if (!isCopied) {
				vscode.postMessage({ type: "copyTask", text: itemId })
				setIsCopied(true)
				setTimeout(() => setIsCopied(false), 2000)
			}
		},
		[isCopied, itemId],
	)

	return (
		<StandardTooltip content={t("history:copyPrompt")}>
			<Button
				variant="ghost"
				size="icon"
				onClick={onCopy}
				className="group-hover:opacity-100 opacity-50 transition-opacity"
				data-testid="copy-prompt-button">
				<span className={cn("codicon scale-80", { "codicon-check": isCopied, "codicon-copy": !isCopied })} />
			</Button>
		</StandardTooltip>
	)
}
