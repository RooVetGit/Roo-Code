import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"

import { buildDocLink } from "@src/utils/docLinks"

const tips = [
	{
		icon: "codicon-account",
		href: buildDocLink("basic-usage/using-modes", "tips"),
		titleKey: "rooTips.customizableModes.title",
		descriptionKey: "rooTips.customizableModes.description",
	},
	{
		icon: "codicon-list-tree",
		href: buildDocLink("features/boomerang-tasks", "tips"),
		titleKey: "rooTips.boomerangTasks.title",
		descriptionKey: "rooTips.boomerangTasks.description",
	},
]

const RooTips = () => {
	const { t } = useTranslation("chat")

	return (
		<div className="flex flex-col items-center justify-center px-5 py-2.5 gap-4">
			{tips.map((tip) => (
				<div
					key={tip.titleKey}
					className="flex items-center gap-2 text-vscode-editor-foreground font-vscode max-w-[250px]">
					<span className={`codicon ${tip.icon}`}></span>
					<span>
						<VSCodeLink className="forced-color-adjust-none" href={tip.href}>
							{t(tip.titleKey)}
						</VSCodeLink>
						: {t(tip.descriptionKey)}
					</span>
				</div>
			))}
		</div>
	)
}

export default RooTips
