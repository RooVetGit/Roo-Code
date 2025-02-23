import { cn } from "@/lib/utils"

import { useResearchSession } from "./useResearchSession"
import { DeepResearchProvider } from "./DeepResearchProvider"
import { HistoryProvider } from "./HistoryProvider"
import { ResearchSession } from "./ResearchSession"
import { ResearchTask } from "./ResearchTask"
import { GetStarted } from "./GetStarted"
import { History } from "./History"

type DeepResearchProps = {
	isHidden: boolean
	onDone: () => void
}

export const DeepResearch = ({ isHidden }: DeepResearchProps) => {
	const { session, task } = useResearchSession()

	if (session) {
		return (
			<div className={cn("fixed inset-0 flex flex-col", { hidden: isHidden })}>
				<DeepResearchProvider>
					<ResearchSession />
				</DeepResearchProvider>
			</div>
		)
	}

	if (task) {
		return (
			<div className={cn("fixed inset-0 flex flex-col", { hidden: isHidden })}>
				<ResearchTask />
			</div>
		)
	}

	return (
		<div
			className={cn("flex flex-col items-center justify-center h-full min-w-64 gap-4 overflow-auto py-4", {
				hidden: isHidden,
			})}>
			<div className="flex flex-col gap-8 max-w-md p-4">
				<GetStarted />
				<HistoryProvider>
					<History />
				</HistoryProvider>
			</div>
		</div>
	)
}
