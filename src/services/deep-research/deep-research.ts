import FirecrawlApp, { SearchResponse } from "@mendable/firecrawl-js"
import { generateObject } from "ai"
import pLimit from "p-limit"
import { z } from "zod"

import { o3MiniModel, trimPrompt } from "./providers"
import { systemPrompt } from "./prompt"

function log(...args: any[]) {
	console.log(...args)
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

// take en user query, return a list of SERP queries
async function generateSerpQueries({
	query,
	numQueries = 3,
	learnings,
}: {
	query: string
	numQueries?: number

	// optional, if provided, the research will continue from the last learning
	learnings?: string[]
}) {
	const res = await generateObject({
		model: o3MiniModel,
		system: systemPrompt(),
		prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
			learnings
				? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
						"\n",
					)}`
				: ""
		}`,
		schema: z.object({
			queries: z
				.array(
					z.object({
						query: z.string().describe("The SERP query"),
						researchGoal: z
							.string()
							.describe(
								"First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.",
							),
					}),
				)
				.describe(`List of SERP queries, max of ${numQueries}`),
		}),
	})
	log(`Created ${res.object.queries.length} queries`, res.object.queries)

	return res.object.queries.slice(0, numQueries)
}

async function processSerpResult({
	query,
	result,
	numLearnings = 3,
	numFollowUpQuestions = 3,
}: {
	query: string
	result: SearchResponse
	numLearnings?: number
	numFollowUpQuestions?: number
}) {
	const contents = result.data
		.map((item) => item.markdown)
		.filter(Boolean)
		.map((content) => trimPrompt(content, 25_000))
	log(`Ran ${query}, found ${contents.length} contents`)

	const res = await generateObject({
		model: o3MiniModel,
		abortSignal: AbortSignal.timeout(60_000),
		system: systemPrompt(),
		prompt: `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
			.map((content) => `<content>\n${content}\n</content>`)
			.join("\n")}</contents>`,
		schema: z.object({
			learnings: z.array(z.string()).describe(`List of learnings, max of ${numLearnings}`),
			followUpQuestions: z
				.array(z.string())
				.describe(`List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`),
		}),
	})
	log(`Created ${res.object.learnings.length} learnings`, res.object.learnings)

	return res.object
}

export async function writeFinalReport({
	prompt,
	learnings,
	visitedUrls,
}: {
	prompt: string
	learnings: string[]
	visitedUrls: string[]
}) {
	const learningsString = trimPrompt(
		learnings.map((learning) => `<learning>\n${learning}\n</learning>`).join("\n"),
		150_000,
	)

	const res = await generateObject({
		model: o3MiniModel,
		system: systemPrompt(),
		prompt: `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
		schema: z.object({
			reportMarkdown: z.string().describe("Final report on the topic in Markdown"),
		}),
	})

	// Append the visited URLs section to the report
	const urlsSection = `\n\n## Sources\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`
	return res.object.reportMarkdown + urlsSection
}

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

	const serpQueries = await generateSerpQueries({
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
