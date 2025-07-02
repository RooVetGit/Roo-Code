import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { SetCachedStateField } from "./types"

type GeneralProps = {
	showAllWorkspacesTasks: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const GeneralSettings = ({ showAllWorkspacesTasks, setCachedStateField }: GeneralProps) => {
	const handleShowAllTasks = (e: any) => {
		const checked = e.target.checked
		setCachedStateField("showAllWorkspacesTasks", checked)
	}

	return (
		<div className="flex flex-col gap-y-2">
			<div className="flex items-center justify-between p-2">
				<div className="flex flex-col">
					<span className="text-vscode-settings-headerForeground text-lg">Show All Tasks</span>
					<span className="text-vscode-descriptionForeground text-sm">
						Show tasks from all projects instead of only the current one
					</span>
				</div>
				<VSCodeCheckbox checked={showAllWorkspacesTasks} onChange={handleShowAllTasks} />
			</div>
		</div>
	)
}
