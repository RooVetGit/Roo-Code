import { useMemo, useRef } from "react"
import { useMount } from "react-use"
import { Cross2Icon, ReaderIcon, RocketIcon, TriangleDownIcon, TriangleUpIcon } from "@radix-ui/react-icons"

import { Button, Progress } from "@/components/ui"
import { Chat } from "@/components/ui/chat"

import { deepResearchModels, ResearchProgress, ResearchStatus, ResearchTokenUsage } from "./types"
import { useDeepResearch } from "./useDeepResearch"
import { useResearchSession } from "./useResearchSession"
import { formatCost, formatTokenCount } from "./format"

export const ResearchSession = () => {
	const initialized = useRef(false)
	const { session } = useResearchSession()
	const { status, progress, tokenUsage, start, ...handler } = useDeepResearch()

	useMount(() => {
		if (session && !initialized.current) {
			start(session)
			initialized.current = true
		}
	})

	if (!session) {
		return null
	}

	return (
		<>
			<Chat assistantName="Deep Research (β)" handler={handler} className="pt-10 pr-[1px]">
				{status === "aborted" && <Aborted />}
				{(status === "research" || status === "done") && (
					<ProgressBar status={status} progress={progress} tokenUsage={tokenUsage} />
				)}
				{status === "done" && <Done />}
			</Chat>
			<Header />
		</>
	)
}

function Header() {
	const { session, setSession } = useResearchSession()
	const { reset } = useDeepResearch()

	return (
		<div className="absolute top-0 left-0 h-10 flex flex-row items-center justify-between gap-2 w-full pl-3 pr-1">
			<div className="flex-1 truncate text-sm text-muted-foreground">{session?.query}</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => {
					setSession(undefined)
					reset?.()
				}}>
				<Cross2Icon />
			</Button>
		</div>
	)
}

function Aborted() {
	const { setSession } = useResearchSession()
	const { reset } = useDeepResearch()

	return (
		<div className="flex flex-row items-center justify-between gap-2 border-t border-vscode-editor-background p-4">
			<div className="text-destructive">Deep research task canceled.</div>
			<Button
				variant="outline"
				size="sm"
				onClick={() => {
					setSession(undefined)
					reset?.()
				}}>
				Done
			</Button>
		</div>
	)
}

function ProgressBar({
	status,
	progress,
	tokenUsage,
}: {
	status: ResearchStatus["status"]
	progress?: ResearchProgress
	tokenUsage?: ResearchTokenUsage
}) {
	const { session } = useResearchSession()

	const model = useMemo(
		() =>
			session
				? deepResearchModels.find(({ modelIds }) => Object.values(modelIds).includes(session.modelId))
				: undefined,
		[session],
	)

	if (!progress && !tokenUsage) {
		return null
	}

	const isProgressing = status !== "done" && progress

	return (
		<div className="flex flex-row items-center justify-end gap-2 border-t border-vscode-editor-background p-4">
			{isProgressing && <Progress value={Math.max(progress.progressPercentage, 5)} className="flex-1" />}
			{tokenUsage && (
				<div className="flex flex-row gap-2 text-sm text-muted-foreground shrink-0 whitespace-nowrap">
					<div className="flex flex-row items-center">
						<TriangleUpIcon />
						{formatTokenCount(tokenUsage.inTokens)}
					</div>
					<div className="flex flex-row items-center">
						<TriangleDownIcon />
						{formatTokenCount(tokenUsage.outTokens)}
					</div>
					{model && <div>{formatCost(tokenUsage.inTokens, tokenUsage.outTokens, model)}</div>}
				</div>
			)}
		</div>
	)
}

function Done() {
	const { viewReport, createTask } = useDeepResearch()

	return (
		<div className="flex flex-row items-center justify-end gap-2 border-t border-vscode-editor-background p-4">
			<Button variant="outline" size="sm" onClick={viewReport}>
				<ReaderIcon />
				View Report
			</Button>
			<Button variant="default" size="sm" onClick={createTask}>
				<RocketIcon />
				Create Task
			</Button>
		</div>
	)
}
