"use client"

import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Ellipsis, Rocket, Download, Trash2, Info, ChevronLeft, ChevronRight, FileText, Settings } from "lucide-react"

import type { Run, TaskMetrics } from "@evals/db"

import { deleteRun } from "@/lib/server/runs"
import { formatCurrency, formatDuration, formatTokens, formatToolUsageSuccessRate } from "@/lib/formatters"
import {
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui"

export function Home({
	runs,
	pagination,
}: {
	runs: (Run & { taskMetrics: TaskMetrics | null })[]
	pagination: {
		page: number
		pageSize: number
		totalCount: number
		totalPages: number
	}
}) {
	const router = useRouter()

	const [deleteRunId, setDeleteRunId] = useState<number>()
	const continueRef = useRef<HTMLButtonElement>(null)

	const onConfirmDelete = useCallback(async () => {
		if (!deleteRunId) {
			return
		}

		try {
			await deleteRun(deleteRunId)
			setDeleteRunId(undefined)
		} catch (error) {
			console.error(error)
		}
	}, [deleteRunId])

	const exportToCSV = useCallback(() => {
		if (!runs || runs.length === 0) return

		// Prepare CSV headers
		const headers = [
			"#",
			"Model",
			"Status",
			"Passed",
			"Failed",
			"Success Rate",
			"Notes",
			"Tokens In",
			"Tokens Out",
			"Context Tokens",
			"Diff Edits",
			"Cost",
			"Duration",
		].join(",")

		// Prepare CSV rows
		const rows = runs.map((run) => {
			const status = run.passed > run.failed ? "PASSED" : run.passed + run.failed > 0 ? "FAILED" : "PENDING"
			const successRate =
				run.passed + run.failed > 0 ? ((run.passed / (run.passed + run.failed)) * 100).toFixed(1) + "%" : "N/A"
			const tokensIn = run.taskMetrics ? run.taskMetrics.tokensIn : 0
			const tokensOut = run.taskMetrics ? run.taskMetrics.tokensOut : 0
			const tokensContext = run.taskMetrics?.tokensContext || 0
			const cost = run.taskMetrics ? run.taskMetrics.cost.toFixed(4) : "0"
			const duration = run.taskMetrics ? (run.taskMetrics.duration / 1000).toFixed(2) : "0"

			// Get diff edits count
			const diffEdits = run.taskMetrics?.toolUsage?.apply_diff?.attempts || 0

			// Escape description to handle commas and quotes
			const escapedDescription = run.description ? `"${run.description.replace(/"/g, '""')}"` : ""

			return [
				run.id,
				run.model,
				status,
				run.passed,
				run.failed,
				successRate,
				escapedDescription,
				tokensIn,
				tokensOut,
				tokensContext,
				diffEdits,
				cost,
				duration,
			].join(",")
		})

		// Combine headers and rows
		const csvContent = [headers, ...rows].join("\n")

		// Create a Blob and download link
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.setAttribute("href", url)
		link.setAttribute("download", `roo-code-evals-${new Date().toISOString().split("T")[0]}.csv`)
		link.style.visibility = "hidden"
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}, [runs])

	return (
		<>
			<div className="flex justify-between items-center mb-6">
				<div>
					<h1 className="text-3xl font-bold">Evaluation Runs</h1>
					<p className="text-muted-foreground mt-1">
						Track and analyze model performance across different programming tasks
					</p>
				</div>
				<div className="flex gap-4">
					{runs.length > 0 && (
						<Button variant="outline" onClick={exportToCSV} title="Export all runs to CSV">
							<Download className="mr-2 h-4 w-4" />
							Export All
						</Button>
					)}
					<Button
						variant="default"
						className="size-10 rounded-full p-0"
						onClick={() => router.push("/runs/new")}
						title="New Evaluation Run">
						<Rocket className="size-5" />
						<span className="sr-only">New Evaluation Run</span>
					</Button>
				</div>
			</div>

			<div className="rounded-md border">
				<div className="p-4 bg-muted/50">
					<h2 className="text-lg font-semibold">Evaluation Results</h2>
				</div>
				<Table className="w-full">
					<TableHeader>
						<TableRow>
							<TableHead>#</TableHead>
							<TableHead>Model</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Passed</TableHead>
							<TableHead>Failed</TableHead>
							<TableHead>% Correct</TableHead>
							<TableHead>Notes</TableHead>
							<TableHead>Tokens In</TableHead>
							<TableHead>Tokens Out</TableHead>
							<TableHead>Context</TableHead>
							<TableHead>Diff Edits</TableHead>
							<TableHead>Cost</TableHead>
							<TableHead>Duration</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{runs.length ? (
							runs.map(({ taskMetrics, ...run }) => (
								<TableRow
									key={run.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() => router.push(`/runs/${run.id}`)}>
									<TableCell>{run.id}</TableCell>
									<TableCell>{run.model}</TableCell>
									<TableCell>
										{run.passed + run.failed > 0 ? (
											<div
												className={`px-2 py-1 rounded-md inline-flex items-center ${
													run.passed > run.failed
														? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
														: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
												}`}>
												{run.passed > run.failed ? "PASSED" : "FAILED"}
											</div>
										) : (
											<div className="px-2 py-1 rounded-md inline-flex items-center bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
												PENDING
											</div>
										)}
									</TableCell>
									<TableCell>{run.passed}</TableCell>
									<TableCell>{run.failed}</TableCell>
									<TableCell>
										{run.passed + run.failed > 0 && (
											<span>{((run.passed / (run.passed + run.failed)) * 100).toFixed(1)}%</span>
										)}
									</TableCell>
									<TableCell>
										{run.description ? (
											<span className="truncate max-w-[250px] block" title={run.description}>
												{run.description}
											</span>
										) : (
											<span className="text-muted-foreground italic">No notes</span>
										)}
									</TableCell>
									<TableCell>{taskMetrics && formatTokens(taskMetrics.tokensIn)}</TableCell>
									<TableCell>{taskMetrics && formatTokens(taskMetrics.tokensOut)}</TableCell>
									<TableCell>
										{taskMetrics?.tokensContext ? (
											formatTokens(taskMetrics.tokensContext)
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</TableCell>
									<TableCell>
										{taskMetrics?.toolUsage?.apply_diff && (
											<div className="flex flex-row items-center gap-1.5">
												<div>{taskMetrics.toolUsage.apply_diff.attempts}</div>
												<div>/</div>
												<div>
													{formatToolUsageSuccessRate(taskMetrics.toolUsage.apply_diff)}
												</div>
											</div>
										)}
									</TableCell>
									<TableCell>{taskMetrics && formatCurrency(taskMetrics.cost)}</TableCell>
									<TableCell>{taskMetrics && formatDuration(taskMetrics.duration)}</TableCell>
									<TableCell onClick={(e) => e.stopPropagation()}>
										<div className="flex items-center gap-2">
											<DropdownMenu>
												<Button variant="ghost" size="icon" asChild>
													<DropdownMenuTrigger>
														<Ellipsis />
													</DropdownMenuTrigger>
												</Button>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation()
															router.push(`/runs/${run.id}`)
														}}>
														<Info className="mr-2 h-4 w-4" />
														View Details
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation()
															// TODO: Implement export functionality
														}}>
														<FileText className="mr-2 h-4 w-4" />
														Export Results
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={(e) => {
															e.stopPropagation()
															setDeleteRunId(run.id)
															setTimeout(() => continueRef.current?.focus(), 0)
														}}
														className="text-red-600 dark:text-red-400">
														<Trash2 className="mr-2 h-4 w-4" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</TableCell>
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={14} className="text-center">
									No eval runs yet.
									<Button variant="link" onClick={() => router.push("/runs/new")}>
										Launch
									</Button>
									one now.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination Controls */}
			{pagination.totalPages > 1 && (
				<div className="flex items-center justify-between mt-4">
					<div className="flex items-center space-x-4">
						<div className="text-sm text-muted-foreground">
							Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
							{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of{" "}
							{pagination.totalCount} runs
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									{pagination.pageSize} per page
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Page Size</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{[10, 20, 50, 100].map((size) => (
									<DropdownMenuItem
										key={size}
										onClick={() => router.push(`/?page=1&pageSize=${size}`)}>
										{size} per page
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="flex items-center space-x-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push(`/?page=${pagination.page - 1}&pageSize=${pagination.pageSize}`)}
							disabled={pagination.page <= 1}>
							<ChevronLeft className="h-4 w-4" />
							<span className="sr-only">Previous Page</span>
						</Button>
						<div className="text-sm">
							Page {pagination.page} of {pagination.totalPages}
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => router.push(`/?page=${pagination.page + 1}&pageSize=${pagination.pageSize}`)}
							disabled={pagination.page >= pagination.totalPages}>
							<ChevronRight className="h-4 w-4" />
							<span className="sr-only">Next Page</span>
						</Button>
					</div>
				</div>
			)}

			<AlertDialog open={!!deleteRunId} onOpenChange={() => setDeleteRunId(undefined)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction ref={continueRef} onClick={onConfirmDelete}>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
