import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

import type { JobType, JobStatus, JobPayload } from "@/types"

/**
 * cloudJobs
 */

export const cloudJobs = pgTable("cloud_jobs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	type: text().notNull().$type<JobType>(),
	status: text().notNull().default("pending").$type<JobStatus>(),
	payload: jsonb().notNull().$type<JobPayload>(),
	result: jsonb(),
	error: text(),
	startedAt: timestamp("started_at"),
	completedAt: timestamp("completed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const cloudJobsRelations = relations(cloudJobs, ({ many }) => ({
	tasks: many(cloudTasks),
}))

export type CloudJob = typeof cloudJobs.$inferSelect

export type InsertCloudJob = typeof cloudJobs.$inferInsert

export type UpdateCloudJob = Partial<Omit<CloudJob, "id" | "createdAt">>

/**
 * cloudTasks
 */

export const cloudTasks = pgTable("cloud_tasks", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	jobId: integer("job_id")
		.references(() => cloudJobs.id)
		.notNull(),
	taskId: integer("task_id"),
	containerId: text("container_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const cloudTasksRelations = relations(cloudTasks, ({ one }) => ({
	job: one(cloudJobs, { fields: [cloudTasks.jobId], references: [cloudJobs.id] }),
}))

export type CloudTask = typeof cloudTasks.$inferSelect

export type InsertCloudTask = typeof cloudTasks.$inferInsert

export type UpdateCloudTask = Partial<Omit<CloudTask, "id" | "createdAt">>

/**
 * schema
 */

export const schema = {
	cloudJobs,
	cloudTasks,
	cloudJobsRelations,
	cloudTasksRelations,
}
