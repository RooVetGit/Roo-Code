import { desc, eq, inArray, sql, sum } from "drizzle-orm"

import { ToolUsage } from "@evals/types"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import type { InsertRun, UpdateRun } from "../schema.js"
import { insertRunSchema, schema } from "../schema.js"
import { db } from "../db.js"
import { createTaskMetrics } from "./taskMetrics.js"
import { getTasks } from "./tasks.js"

export const findRun = async (id: number) => {
	const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createRun = async (args: InsertRun) => {
	const records = await db
		.insert(schema.runs)
		.values({
			...insertRunSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updateRun = async (id: number, values: UpdateRun) => {
	const records = await db.update(schema.runs).set(values).where(eq(schema.runs.id, id)).returning()
	const record = records[0]

	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

export const getRuns = async (page = 1, pageSize = 100) => {
	// Ensure page and pageSize are valid
	const validPage = Math.max(1, page)
	const validPageSize = Math.min(Math.max(1, pageSize), 100) // Limit max page size to 100

	// Calculate offset
	const offset = (validPage - 1) * validPageSize

	// Get paginated results
	const runs = await db.query.runs.findMany({
		orderBy: schema.runs.id, // Sort by ID in ascending order (oldest first)
		with: { taskMetrics: true },
		limit: validPageSize,
		offset,
	})

	// Get total count for pagination info
	const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.runs)

	return {
		data: runs,
		pagination: {
			page: validPage,
			pageSize: validPageSize,
			totalCount: count,
			totalPages: Math.ceil(count / validPageSize),
		},
	}
}

// For backward compatibility
export const getAllRuns = async () => db.query.runs.findMany({ orderBy: schema.runs.id, with: { taskMetrics: true } })

export const finishRun = async (runId: number) => {
	const [values] = await db
		.select({
			tokensIn: sum(schema.taskMetrics.tokensIn).mapWith(Number),
			tokensOut: sum(schema.taskMetrics.tokensOut).mapWith(Number),
			tokensContext: sum(schema.taskMetrics.tokensContext).mapWith(Number),
			cacheWrites: sum(schema.taskMetrics.cacheWrites).mapWith(Number),
			cacheReads: sum(schema.taskMetrics.cacheReads).mapWith(Number),
			cost: sum(schema.taskMetrics.cost).mapWith(Number),
			duration: sum(schema.taskMetrics.duration).mapWith(Number),
			passed: sql<number>`sum(${schema.tasks.passed} = 1)`,
			failed: sql<number>`sum(${schema.tasks.passed} = 0)`,
		})
		.from(schema.taskMetrics)
		.innerJoin(schema.tasks, eq(schema.taskMetrics.id, schema.tasks.taskMetricsId))
		.innerJoin(schema.runs, eq(schema.tasks.runId, schema.runs.id))
		.where(eq(schema.runs.id, runId))

	if (!values) {
		throw new RecordNotFoundError()
	}

	const tasks = await getTasks(runId)

	interface TaskWithMetrics {
		taskMetrics?: {
			toolUsage?: Record<string, { attempts: number; failures: number }>
		} | null
	}

	const toolUsage = tasks.reduce((acc: ToolUsage, task: TaskWithMetrics) => {
		Object.entries(task.taskMetrics?.toolUsage || {}).forEach(([key, value]) => {
			// Type assertion for the value
			const toolData = value as { attempts: number; failures: number }
			const tool = key as keyof ToolUsage
			acc[tool] ??= { attempts: 0, failures: 0 }
			acc[tool].attempts += toolData.attempts
			acc[tool].failures += toolData.failures
		})

		return acc
	}, {} as ToolUsage)

	const { passed, failed, ...rest } = values
	const taskMetrics = await createTaskMetrics({ ...rest, toolUsage })
	await updateRun(runId, { taskMetricsId: taskMetrics.id, passed, failed })

	const run = await findRun(runId)

	if (!run) {
		throw new RecordNotFoundError()
	}

	return { ...run, taskMetrics }
}

export const deleteRun = async (runId: number) => {
	const run = await db.query.runs.findFirst({
		where: eq(schema.runs.id, runId),
		columns: { taskMetricsId: true },
	})

	if (!run) {
		throw new RecordNotFoundError()
	}

	const tasks = await db.query.tasks.findMany({
		where: eq(schema.tasks.runId, runId),
		columns: { id: true, taskMetricsId: true },
	})

	// Get all task IDs to delete related tool errors
	const taskIds = tasks.map((task: { id: number }) => task.id)

	// First delete any tool errors related to this run or its tasks
	await db.delete(schema.toolErrors).where(eq(schema.toolErrors.runId, runId))
	if (taskIds.length > 0) {
		await db.delete(schema.toolErrors).where(inArray(schema.toolErrors.taskId, taskIds))
	}

	// Then delete tasks and the run
	await db.delete(schema.tasks).where(eq(schema.tasks.runId, runId))
	await db.delete(schema.runs).where(eq(schema.runs.id, runId))

	// Finally delete task metrics
	const taskMetricsIds = tasks
		.map(({ taskMetricsId }: { taskMetricsId: number | null }) => taskMetricsId)
		.filter((id: number | null): id is number => id !== null && id !== undefined)

	taskMetricsIds.push(run.taskMetricsId ?? -1)

	await db.delete(schema.taskMetrics).where(inArray(schema.taskMetrics.id, taskMetricsIds))
}
