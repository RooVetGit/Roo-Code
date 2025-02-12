import { cn } from "@/lib/utils"

import { useSession } from "./useSession"
import { GetStarted } from "./GetStarted"
import { History } from "./History"
import { Session } from "./Session"

type DeepResearchProps = {
	isHidden: boolean
	onDone: () => void
}

export const DeepResearch = ({ isHidden }: DeepResearchProps) => {
	const { session } = useSession()

	return (
		<div className={cn("fixed inset-0 flex flex-col overflow-hidden", { hidden: isHidden })}>
			{session ? (
				<Session />
			) : (
				<div className="flex flex-col items-center justify-center h-full gap-4">
					<GetStarted />
					<History />
				</div>
			)}
		</div>
	)
}
