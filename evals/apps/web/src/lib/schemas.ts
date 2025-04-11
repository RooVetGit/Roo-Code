import { z } from "zod"

import { rooCodeSettingsSchema } from "@evals/types"

/**
 * CreateRun
 */

export const createRunSchema = z
	.object({
		model: z.string().min(1, { message: "Model is required." }),
		description: z.string().optional(),
		suite: z.enum(["full", "partial"]),
		exercises: z.array(z.string()).optional(),
		settings: rooCodeSettingsSchema.optional(),
		concurrency: z.number().int().min(1).max(10).default(2),
	})
	.refine((data) => data.suite === "full" || (data.exercises || []).length > 0, {
		message: "Exercises are required when running a partial suite.",
		path: ["exercises"],
	})

export type CreateRun = z.infer<typeof createRunSchema>
