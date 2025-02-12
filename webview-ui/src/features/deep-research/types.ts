import { z } from "zod"

export const sessionSchema = z.object({
	modelId: z.string().min(1),
	breadth: z.number().min(1).max(10),
	depth: z.number().min(1).max(10),
	query: z.string().min(1),
})

export type Session = z.infer<typeof sessionSchema>
