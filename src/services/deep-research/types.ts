import { z } from "zod"

/**
 * ResearchInquiry
 */

const researchInquirySchema = z.object({
	initialQuery: z.string().optional(),
	followUps: z.array(z.string()),
	responses: z.array(z.string()),
	query: z.string().optional(),
	learnings: z.array(z.string()).optional(),
	urls: z.array(z.string()).optional(),
	report: z.string().optional(),
	fileUri: z.string().optional(),
})

export type ResearchInquiry = z.infer<typeof researchInquirySchema>

/**
 * ResearchStep
 */

export type ResearchStep = {
	query: string
	breadth: number
	depth: number
	learnings?: string[]
	visitedUrls?: string[]
	onProgressUpdated: () => void
	onGeneratedQueries: (queries: ResearchQuery[]) => void
	onExtractedLearnings: (learnings: ResearchLearnings & { urls: string[] }) => void
}

/**
 * ResearchProgress
 */

export type ResearchProgress = {
	expectedQueries: number
	completedQueries: number
	progressPercentage: number
}

/**
 * ResearchResult
 */

export type ResearchResult = {
	learnings: string[]
	visitedUrls: string[]
}

/**
 * ResearchQuery
 */

export const researchQuerySchema = z.object({
	query: z.string(),
	researchGoal: z.string(),
})

export type ResearchQuery = z.infer<typeof researchQuerySchema>

/**
 * ResearchLearnings
 */

export const researchLearningsSchema = z.object({
	learnings: z.array(z.string()),
	followUpQuestions: z.array(z.string()),
})

export type ResearchLearnings = z.infer<typeof researchLearningsSchema>

/**
 * ResearchTokenUsage
 */

export type ResearchTokenUsage = {
	inTokens: number
	outTokens: number
	totalTokens: number
}

/**
 * ResearchOutput
 */

export enum ResearchRole {
	User = "user",
	Assistant = "assistant",
}

export enum ResearchAnnotationType {
	Badge = "badge",
}

const researchAnnotationSchema = z.object({
	type: z.nativeEnum(ResearchAnnotationType),
	data: z.object({
		label: z.string(),
		variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
	}),
})

export type ResearchAnnotation = z.infer<typeof researchAnnotationSchema>

const researchOutputSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	annotations: z.array(researchAnnotationSchema).optional(),
})

export type ResearchOutput = z.infer<typeof researchOutputSchema>

/**
 * ResearchTask
 */

export const researchTaskSchema = z.object({
	taskId: z.string(),
	providerId: z.string(),
	modelId: z.string(),
	breadth: z.number(),
	depth: z.number(),
	concurrency: z.number(),
	inquiry: researchInquirySchema,
	output: z.array(researchOutputSchema),
	messages: z.array(z.any()),
	createdAt: z.number(),
})

export type ResearchTask = z.infer<typeof researchTaskSchema>
