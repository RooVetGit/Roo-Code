import FirecrawlApp from "@mendable/firecrawl-js"
import pLimit from "p-limit"

import { o3MiniModel } from "./providers"
import { generateSerpQueries, processSerpResult } from "./utils/serp"

function log(...args: any[]) {
	console.log(...args)
}

const systemPrompt = () => {
	const now = new Date().toISOString()

	return `You are an expert researcher. Today is ${now}. Follow these instructions when responding:
    - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
    - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
    - Be highly organized.
    - Suggest solutions that I didn't think about.
    - Be proactive and anticipate my needs.
    - Treat me as an expert in all subject matter.
    - Mistakes erode my trust, so be accurate and thorough.
    - Provide detailed explanations, I'm comfortable with lots of detail.
    - Value good arguments over authorities, the source is irrelevant.
    - Consider new technologies and contrarian ideas, not just the conventional wisdom.
    - You may use high levels of speculation or prediction, just flag it for me.`
}

export type ResearchProgress = {
	currentDepth: number
	totalDepth: number
	currentBreadth: number
	totalBreadth: number
	currentQuery?: string
	totalQueries: number
	completedQueries: number
}

type ResearchResult = {
	learnings: string[]
	visitedUrls: string[]
}

// increase this if you have higher API rate limits
const ConcurrencyLimit = 2

// Initialize Firecrawl with optional API key and optional base url

const firecrawl = new FirecrawlApp({
	apiKey: process.env.FIRECRAWL_KEY ?? "",
	apiUrl: process.env.FIRECRAWL_BASE_URL,
})

export async function deepResearch({
	query,
	breadth,
	depth,
	learnings = [],
	visitedUrls = [],
	onProgress,
}: {
	query: string
	breadth: number
	depth: number
	learnings?: string[]
	visitedUrls?: string[]
	onProgress?: (progress: ResearchProgress) => void
}): Promise<ResearchResult> {
	const progress: ResearchProgress = {
		currentDepth: depth,
		totalDepth: depth,
		currentBreadth: breadth,
		totalBreadth: breadth,
		totalQueries: 0,
		completedQueries: 0,
	}

	const reportProgress = (update: Partial<ResearchProgress>) => {
		Object.assign(progress, update)
		onProgress?.(progress)
	}

	const model = o3MiniModel
	const system = systemPrompt()

	const serpQueries = await generateSerpQueries({
		model,
		system,
		query,
		learnings,
		numQueries: breadth,
	})

	reportProgress({
		totalQueries: serpQueries.length,
		currentQuery: serpQueries[0]?.query,
	})

	const limit = pLimit(ConcurrencyLimit)

	const results = await Promise.all(
		serpQueries.map((serpQuery) =>
			limit(async () => {
				try {
					const result = await firecrawl.search(serpQuery.query, {
						timeout: 15000,
						limit: 5,
						scrapeOptions: { formats: ["markdown"] },
					})

					// Collect URLs from this search
					const newUrls = result.data
						.map((item) => item.url)
						.filter((url): url is string => url !== undefined)
					const newBreadth = Math.ceil(breadth / 2)
					const newDepth = depth - 1

					const newLearnings = await processSerpResult({
						model,
						system,
						query: serpQuery.query,
						result,
						numFollowUpQuestions: newBreadth,
					})
					const allLearnings = [...learnings, ...newLearnings.learnings]
					const allUrls = [...visitedUrls, ...newUrls]

					if (newDepth > 0) {
						log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`)

						reportProgress({
							currentDepth: newDepth,
							currentBreadth: newBreadth,
							completedQueries: progress.completedQueries + 1,
							currentQuery: serpQuery.query,
						})

						const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map((q) => `\n${q}`).join("")}
          `.trim()

						return deepResearch({
							query: nextQuery,
							breadth: newBreadth,
							depth: newDepth,
							learnings: allLearnings,
							visitedUrls: allUrls,
							onProgress,
						})
					} else {
						reportProgress({
							currentDepth: 0,
							completedQueries: progress.completedQueries + 1,
							currentQuery: serpQuery.query,
						})
						return {
							learnings: allLearnings,
							visitedUrls: allUrls,
						}
					}
				} catch (e: any) {
					if (e.message && e.message.includes("Timeout")) {
						log(`Timeout error running query: ${serpQuery.query}: `, e)
					} else {
						log(`Error running query: ${serpQuery.query}: `, e)
					}
					return {
						learnings: [],
						visitedUrls: [],
					}
				}
			}),
		),
	)

	return {
		learnings: [...new Set(results.flatMap((r) => r.learnings))],
		visitedUrls: [...new Set(results.flatMap((r) => r.visitedUrls))],
	}
}
