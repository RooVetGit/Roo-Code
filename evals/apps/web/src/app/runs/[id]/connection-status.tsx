import { EventSourceStatus } from "@/hooks/use-event-source"
import { cn } from "@/lib/utils"

type ConnectionStatusProps = {
	status: EventSourceStatus
	pid: number | null
}

export const ConnectionStatus = ({ status, pid }: ConnectionStatusProps) => (
	<div className="flex items-center">
		<div className="flex flex-col items-end gap-1 font-mono text-xs border-r border-dotted pr-4 mr-4">
			<div>
				Status: <span className="capitalize">{status}</span>
			</div>
			<div>PID: {pid}</div>
		</div>
		<div className="relative">
			<div
				className={cn("absolute size-2.5 rounded-full opacity-50 animate-ping", {
					"bg-green-500": status === "connected",
					"bg-amber-500": status === "waiting",
					"bg-rose-500": status === "error",
				})}
			/>
			<div
				className={cn("size-2.5 rounded-full", {
					"bg-green-500": status === "connected",
					"bg-amber-500": status === "waiting",
					"bg-rose-500": status === "error",
				})}
			/>
		</div>
	</div>
)
