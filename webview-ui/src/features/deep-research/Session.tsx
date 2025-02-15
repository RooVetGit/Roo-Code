import { useRef } from "react"
import { useMount } from "react-use"
import { Cross2Icon, ReaderIcon, RocketIcon, TriangleDownIcon, TriangleUpIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"

import { Button, Progress } from "@/components/ui"
import { Chat } from "@/components/ui/chat"

import { ResearchProgress, ResearchStatus, ResearchTokenUsage } from "./types"
import { useDeepResearch } from "./useDeepResearch"
import { useSession } from "./useSession"

export const Session = () => {
	const initialized = useRef(false)
	const { session } = useSession()
	const { status, progress, tokenUsage, start, ...handler } = useDeepResearch()
	const { isLoading, loadingMessage } = handler

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
			<Chat handler={handler} className="pt-10 pr-[1px]">
				{isLoading && <Loading message={loadingMessage} />}
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
	const { session, setSession } = useSession()
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

function Loading({ message }: { message?: string }) {
	return (
		<div className="flex flex-row items-center justify-end px-5 py-2">
			<Loader2 className="h-4 w-4 animate-spin opacity-25" />
			{message && <div className="ml-2 text-sm text-muted-foreground">{message}</div>}
		</div>
	)
}

function Aborted() {
	const { setSession } = useSession()
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
						{formatTokenCount(tokenUsage.inTokens)}k
					</div>
					<div className="flex flex-row items-center">
						<TriangleDownIcon />
						{formatTokenCount(tokenUsage.outTokens)}k
					</div>
					<div>{formatCost(tokenUsage.inTokens, tokenUsage.outTokens)}</div>
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

function formatTokenCount(tokens: number) {
	return tokens < 100_000 ? (tokens / 1000).toFixed(1) : Math.round(tokens / 1000)
}

const PRICING = {
	"gpt-4o": { in: 2.5, out: 10.0 },
	"gpt-4o-mini": { in: 0.15, out: 0.6 },
	o1: { in: 15.0, out: 60.0 },
	"o1-mini": { in: 1.1, out: 4.4 },
	// "o3": {},
	"o3-mini": { in: 1.1, out: 4.4 },
}

function formatCost(inTokens: number, outTokens: number, model: keyof typeof PRICING = "gpt-4o-mini") {
	const costIn = (inTokens / 1_000_000) * PRICING[model].in
	const costOut = (outTokens / 1_000_000) * PRICING[model].out
	const costTotal = costIn + costOut
	return currencyFormatter.format(costTotal)
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
