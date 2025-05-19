"use client"

import { useMemo, useState } from "react" // Added useState
import { useRouter } from "next/navigation"
import { LoaderCircle, Download, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react" // Added Chevrons

import * as db from "@evals/db"
import { rooCodeDefaults } from "@evals/types" // Added rooCodeDefaults
import { CONCURRENCY_DEFAULT } from "@/lib/schemas" // Added CONCURRENCY_DEFAULT
import { formatCurrency, formatDuration, formatTokens } from "@/lib/formatters"
import { useRunStatus } from "@/hooks/use-run-status"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Button,
	Collapsible, // Added Collapsible components
	CollapsibleContent,
	CollapsibleTrigger,
	// ScrollArea, // Removed ScrollArea
} from "@/components/ui"
// import { SettingsDiff } from "../new/settings-diff" // Removed SettingsDiff

import { TaskStatus } from "./task-status"
import { ConnectionStatus } from "./connection-status"
import { EventSourceStatus } from "@/hooks/use-event-source"
import { RooCodeSettings } from "@evals/types" // Added RooCodeSettings type

type TaskMetrics = Pick<db.TaskMetrics, "tokensIn" | "tokensOut" | "tokensContext" | "duration" | "cost">

interface Task extends db.Task {
	taskMetrics?: TaskMetrics | null
}

// Mapping from setting keys to human-readable labels
const settingLabels: Partial<Record<keyof RooCodeSettings, string>> = {
	modelTemperature: "Model Temperature",
	reasoningEffort: "Reasoning Effort",
	includeMaxTokens: "Include Max Tokens",
	terminalOutputLineLimit: "Terminal Output Limit",
	terminalShellIntegrationTimeout: "Terminal Integration Timeout",
	// terminalShellIntegrationDisabled: "Terminal Integration Disabled", // Removed incorrect key
	terminalCommandDelay: "Terminal Command Delay",
	terminalPowershellCounter: "Terminal PowerShell Counter",
	terminalZshClearEolMark: "Terminal Zsh Clear EOL Mark",
	terminalZshOhMy: "Terminal Zsh Oh My",
	terminalZshP10k: "Terminal Zsh P10k",
	terminalZdotdir: "Terminal Zdotdir",
	// terminalCompressProgressBar: "Compress Terminal Progress", // Removed incorrect key
	allowedCommands: "Allowed Commands",
	maxReadFileLine: "Max Read File Line",
	maxOpenTabsContext: "Max Open Tabs Context",
	maxWorkspaceFiles: "Max Workspace Files",
	rateLimitSeconds: "Rate Limit (s)",
	requestDelaySeconds: "Request Delay (s)",
	writeDelayMs: "Write Delay (ms)",
	fuzzyMatchThreshold: "Fuzzy Match Threshold",
	autoApprovalEnabled: "Auto-Approval",
	alwaysAllowReadOnly: "Always Allow ReadOnly (Workspace)",
	alwaysAllowReadOnlyOutsideWorkspace: "Always Allow ReadOnly (Outside)",
	alwaysAllowWrite: "Always Allow Write (Workspace)",
	alwaysAllowWriteOutsideWorkspace: "Always Allow Write (Outside)",
	alwaysAllowBrowser: "Always Allow Browser",
	alwaysApproveResubmit: "Always Approve Resubmit",
	alwaysAllowMcp: "Always Allow MCP",
	alwaysAllowModeSwitch: "Always Allow Mode Switch",
	alwaysAllowSubtasks: "Always Allow Subtasks",
	alwaysAllowExecute: "Always Allow Execute",
	diffEnabled: "Diff View Enabled",
	// Add more labels as needed
}

// Function to format setting values for display
const formatSettingValue = (value: any): string => {
	if (typeof value === "boolean") {
		return value ? "Enabled" : "Disabled"
	}
	if (Array.isArray(value)) {
		// Handle '*' specifically for allowedCommands
		if (value.length === 1 && value[0] === "*") {
			return "All (*)"
		}
		return value.join(", ") || "(empty)"
	}
	if (value === null || value === undefined) {
		return "(default)"
	}
	return String(value)
}

export function Run({ run }: { run: db.Run }) {
	const router = useRouter()
	const [isSettingsOpen, setIsSettingsOpen] = useState(false) // State for settings collapsible
	const { tasks, status, tokenUsage, usageUpdatedAt } = useRunStatus(run) as {
		tasks: Task[]
		status: EventSourceStatus
		tokenUsage: Map<number, any>
		usageUpdatedAt: number
	}

	const taskMetrics: Record<number, TaskMetrics> = useMemo(() => {
		const metrics: Record<number, TaskMetrics> = {}

		tasks?.forEach((task) => {
			const usage = tokenUsage.get(task.id)

			if (task.finishedAt && task.taskMetrics) {
				metrics[task.id] = task.taskMetrics
			} else if (usage) {
				metrics[task.id] = {
					tokensIn: usage.totalTokensIn,
					tokensOut: usage.totalTokensOut,
					tokensContext: usage.contextTokens,
					duration: usage.duration ?? 0,
					cost: usage.totalCost,
				}
			}
		})

		return metrics
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tasks, tokenUsage, usageUpdatedAt])

	const exportToCSV = () => {
		if (!tasks || tasks.length === 0) return

		// Prepare CSV headers
		const headers = [
			"Exercise",
			"Language",
			"Status",
			"Tokens In",
			"Tokens Out",
			"Context Tokens",
			"Duration (s)",
			"Cost ($)",
		].join(",")

		// Prepare CSV rows
		const rows = tasks.map((task) => {
			const metrics = taskMetrics[task.id]
			const status = task.passed === true ? "Passed" : task.passed === false ? "Failed" : "Pending"
			const tokensIn = metrics ? metrics.tokensIn : 0
			const tokensOut = metrics ? metrics.tokensOut : 0
			const contextTokens = metrics ? metrics.tokensContext : 0
			const duration = metrics ? (metrics.duration / 1000).toFixed(2) : "0"
			const cost = metrics ? metrics.cost.toFixed(4) : "0"

			return [task.exercise, task.language, status, tokensIn, tokensOut, contextTokens, duration, cost].join(",")
		})

		// Combine headers and rows
		const csvContent = [headers, ...rows].join("\n")

		// Create a Blob and download link
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.setAttribute("href", url)
		link.setAttribute("download", `run-${run.id}-results.csv`)
		link.style.visibility = "hidden"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	// Filter and format settings that differ from defaults
	const nonDefaultSettings = useMemo(() => {
		const settings = (run.settings || {}) as Partial<RooCodeSettings> // Cast to partial for easier comparison
		const defaults = rooCodeDefaults as RooCodeSettings
		const diff: { label: string; value: string }[] = []

		// Iterate over known setting keys with labels
		for (const key in settingLabels) {
			const typedKey = key as keyof RooCodeSettings
			const runValue = settings[typedKey]
			const defaultValue = defaults[typedKey]

			// Check if the key exists in run settings and differs from default
			if (
				runValue !== undefined &&
				runValue !== null && // Explicitly check for null
				JSON.stringify(runValue) !== JSON.stringify(defaultValue) // Compare values robustly
			) {
				diff.push({
					label: settingLabels[typedKey]!,
					value: formatSettingValue(runValue),
				})
			}
		}
		// Add concurrency separately if it differs from the imported default
		if (run.concurrency !== CONCURRENCY_DEFAULT) {
			diff.push({
				label: "Concurrency",
				value: formatSettingValue(run.concurrency),
			})
		}

		// Sort alphabetically by label
		diff.sort((a, b) => a.label.localeCompare(b.label))

		return diff
	}, [run.settings, run.concurrency])

	const hasNonDefaultSettings = nonDefaultSettings.length > 0

	return (
		<>
			<div>
				<div className="mb-6">
					<div className="flex justify-between items-start">
						{" "}
						{/* Changed items-center to items-start */}
						<div>
							<h1 className="text-3xl font-bold">Run #{run.id}</h1>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 mt-4">
								{" "}
								{/* Use 4 columns */}
								{/* API Provider */}
								<div>
									<div className="text-sm font-medium text-muted-foreground">API Provider</div>
									<div>{run.settings?.apiProvider || "Unknown"}</div>
								</div>
								{/* Model */}
								<div>
									<div className="text-sm font-medium text-muted-foreground">Model</div>
									<div>{run.model.includes("/") ? run.model.split("/")[1] : run.model}</div>
								</div>
								{/* Temperature */}
								<div>
									<div className="text-sm font-medium text-muted-foreground">Temperature</div>
									<div>
										{run.settings?.modelTemperature !== undefined &&
										run.settings?.modelTemperature !== null &&
										run.settings?.modelTemperature !== rooCodeDefaults.modelTemperature
											? run.settings.modelTemperature
											: "(default)"}
									</div>
								</div>
								{/* Concurrency */}
								<div>
									<div className="text-sm font-medium text-muted-foreground">Concurrency</div>
									<div>{run.concurrency !== CONCURRENCY_DEFAULT ? run.concurrency : "(default)"}</div>
								</div>
								{/* Notes */}
								{run.description && (
									<div className="col-span-full md:col-span-4">
										{" "}
										{/* Span full width */}
										<div className="text-sm font-medium text-muted-foreground">Notes</div>
										<div className="max-w-[500px]">{run.description}</div>
									</div>
								)}
							</div>
							{/* Settings Collapsible Section */}
							{hasNonDefaultSettings && ( // Only show if there are non-default settings
								<Collapsible
									open={isSettingsOpen}
									onOpenChange={setIsSettingsOpen}
									className="mt-4 border rounded-md max-w-xl">
									{" "}
									{/* Added max-width */}
									<CollapsibleTrigger asChild>
										<Button variant="ghost" className="flex w-full justify-between p-2">
											<span className="font-medium">
												Other Configuration ({nonDefaultSettings.length} non-default)
											</span>
											{isSettingsOpen ? (
												<ChevronUp className="h-4 w-4" />
											) : (
												<ChevronDown className="h-4 w-4" />
											)}
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent className="p-4">
										<div className="space-y-2">
											{nonDefaultSettings.map(({ label, value }) => (
												<div key={label} className="flex justify-between text-sm">
													<span className="text-muted-foreground">{label}:</span>
													<span className="font-mono text-right">{value}</span>
												</div>
											))}
										</div>
									</CollapsibleContent>
								</Collapsible>
							)}
						</div>
						<div className="flex items-center gap-4">
							<Button variant="outline" size="sm" onClick={() => router.push("/")} title="Back to runs">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back
							</Button>
							{tasks && tasks.length > 0 && (
								<Button variant="outline" size="sm" onClick={exportToCSV} title="Export results to CSV">
									<Download className="mr-2 h-4 w-4" />
									Export CSV
								</Button>
							)}
							{!run.taskMetricsId && <ConnectionStatus status={status} pid={run.pid} />}
						</div>
					</div>
				</div>
				{!tasks ? (
					<div className="flex justify-center py-8">
						<LoaderCircle className="size-6 animate-spin" />
					</div>
				) : (
					<div className="rounded-md border">
						<div className="p-4 bg-muted/50">
							<h2 className="text-lg font-semibold">Task Results</h2>
						</div>
						<Table className="w-full">
							<TableHeader>
								<TableRow>
									<TableHead>Exercise</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Cost</TableHead>
									<TableHead>Tokens In</TableHead>
									<TableHead>Tokens Out</TableHead>
									<TableHead>Context</TableHead>
									<TableHead>Duration</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tasks.map((task) => (
									<TableRow key={task.id}>
										<TableCell>
											<div className="truncate max-w-[250px]">
												{task.language}/{task.exercise}
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2 whitespace-nowrap">
												<TaskStatus
													task={task}
													running={!!task.startedAt || !!tokenUsage.get(task.id)}
												/>
												<span>
													{task.passed === true
														? "Passed"
														: task.passed === false
															? "Failed"
															: "Pending"}
												</span>
											</div>
										</TableCell>
										<TableCell className="font-mono text-sm whitespace-nowrap">
											{taskMetrics[task.id] && formatCurrency(taskMetrics[task.id]!.cost)}
										</TableCell>
										{taskMetrics[task.id] ? (
											<>
												<TableCell className="font-mono text-sm whitespace-nowrap">
													{formatTokens(taskMetrics[task.id]!.tokensIn)}
												</TableCell>
												<TableCell className="font-mono text-sm whitespace-nowrap">
													{formatTokens(taskMetrics[task.id]!.tokensOut)}
												</TableCell>
												<TableCell className="font-mono text-sm whitespace-nowrap">
													{formatTokens(taskMetrics[task.id]!.tokensContext)}
												</TableCell>
												<TableCell className="font-mono text-sm whitespace-nowrap">
													{taskMetrics[task.id]!.duration
														? formatDuration(taskMetrics[task.id]!.duration)
														: "-"}
												</TableCell>
											</>
										) : (
											<>
												<TableCell />
												<TableCell />
												<TableCell />
												<TableCell />
											</>
										)}
									</TableRow>
								))}
								{tasks.length === 0 && (
									<TableRow>
										<TableCell colSpan={7} className="text-center py-6">
											<div className="text-muted-foreground">No tasks found for this run.</div>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</>
	)
}
