import { z } from "zod"

import { MessageAnnotationType } from "@/components/ui/chat"

export const sessionSchema = z.object({
	providerId: z.string().min(1, { message: "Select a configuration profile." }),
	providerApiKey: z.string().min(1, { message: "Provider API key is required." }),
	firecrawlApiKey: z.string().min(1, { message: "Firecrawl API key is required." }),
	modelId: z.string().min(1, { message: "Model is required." }),
	breadth: z.number().min(1).max(10, { message: "Breadth must be between 1 and 10." }),
	depth: z.number().min(0).max(9, { message: "Depth must be between 0 and 9." }),
	concurrency: z.number().min(1).max(5, { message: "Concurrency must be between 1 and 5." }),
	query: z.string().min(1, { message: "Research topic is required." }),
})

export type Session = z.infer<typeof sessionSchema>

export const loadingSchema = z.object({
	message: z.string().optional(),
	isLoading: z.boolean(),
})

export type Loading = z.infer<typeof loadingSchema>

export const researchProgressSchema = z.object({
	completedQueries: z.number().min(0),
	expectedQueries: z.number().min(0),
	progressPercentage: z.number().min(0).max(100),
})

export type ResearchProgress = z.infer<typeof researchProgressSchema>

export const outputSchema = z.object({
	content: z.string().min(1),
	annotations: z
		.array(
			z.object({
				type: z.nativeEnum(MessageAnnotationType),
				data: z.unknown(),
			}),
		)
		.optional(),
	streaming: z.boolean().optional(),
})

export type Output = z.infer<typeof outputSchema>

export const researchStatusSchema = z.object({
	status: z.enum(["idle", "followUp", "research", "done", "aborted"]),
})

export type ResearchStatus = z.infer<typeof researchStatusSchema>

export const researchTokenUsageSchema = z.object({
	inTokens: z.number().min(0),
	outTokens: z.number().min(0),
	totalTokens: z.number().min(0),
})

export type ResearchTokenUsage = z.infer<typeof researchTokenUsageSchema>
