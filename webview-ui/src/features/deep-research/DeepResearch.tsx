import { cn } from "@/lib/utils"

import { useSession } from "./useSession"
import { DeepResearchProvider } from "./DeepResearchProvider"
import { Session } from "./Session"
import { GetStarted } from "./GetStarted"
import { History } from "./History"

type DeepResearchProps = {
	isHidden: boolean
	onDone: () => void
}

export const DeepResearch = ({ isHidden }: DeepResearchProps) => {
	const { session } = useSession()

	if (session) {
		return (
			<div className={cn("fixed inset-0 flex flex-col", { hidden: isHidden })}>
				<DeepResearchProvider>
					<Session />
				</DeepResearchProvider>
			</div>
		)
	}

	return (
		<div
			className={cn("flex flex-col items-center justify-center h-full min-w-64 gap-4 overflow-auto py-4", {
				hidden: isHidden,
			})}>
			<GetStarted />
			<History />
		</div>
	)
}
