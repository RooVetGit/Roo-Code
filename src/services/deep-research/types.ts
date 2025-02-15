import { Uri } from "vscode"
import { z } from "zod"

export interface ResearchInquiry {
	initialQuery?: string
	followUps: string[]
	responses: string[]
	query?: string
	learnings?: string[]
	urls?: string[]
	report?: string
	fileUri?: Uri
}

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

export type ResearchProgress = {
	expectedQueries: number
	completedQueries: number
	progressPercentage: number
}

export type ResearchResult = {
	learnings: string[]
	visitedUrls: string[]
}

export const researchQuerySchema = z.object({
	query: z.string(),
	researchGoal: z.string(),
})

export type ResearchQuery = z.infer<typeof researchQuerySchema>

export const researchLearningsSchema = z.object({
	learnings: z.array(z.string()),
	followUpQuestions: z.array(z.string()),
})

export type ResearchLearnings = z.infer<typeof researchLearningsSchema>

export type ResearchTokenUsage = {
	inTokens: number
	outTokens: number
	totalTokens: number
}
