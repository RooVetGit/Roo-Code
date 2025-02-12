import { createOpenAI } from "@ai-sdk/openai"
import FirecrawlApp from "@mendable/firecrawl-js"
import { generateObject, LanguageModel } from "ai"
import { z } from "zod"
import pLimit from "p-limit"

import { ExtensionMessage } from "../../shared/ExtensionMessage"

import { generateSerpQueries, processSerpResult } from "./utils/serp"
import { ClineProvider } from "../../core/webview/ClineProvider"

export type ResearchProgress = {
	currentDepth: number
	totalDepth: number
	currentBreadth: number
	totalBreadth: number
	currentQuery?: string
	totalQueries: number
	completedQueries: number
}

export type ResearchResult = {
	learnings: string[]
	visitedUrls: string[]
}

const firecrawl = new FirecrawlApp({
	apiKey: process.env.FIRECRAWL_KEY ?? "",
	apiUrl: process.env.FIRECRAWL_BASE_URL,
})

export class DeepResearchService {
	private providerRef: WeakRef<ClineProvider>
	private model: LanguageModel
	private initialQuery?: string
	private combinedQuery?: string
	private questions: string[] = []
	private answers: string[] = []
	private status: "idle" | "feedback" | "research" | "done" = "idle"

	constructor(
		clineProvider: ClineProvider,
		public readonly modelId = "o3-mini",
		public readonly breadth = 4,
		public readonly depth = 2,
		public readonly concurrency = 2,
	) {
		this.providerRef = new WeakRef(clineProvider)

		const modelProvider = createOpenAI({
			apiKey: process.env.OPENAI_API_KEY,
			baseURL: "https://api.openai.com/v1",
		})

		this.model = modelProvider(modelId, {
			// reasoningEffort: "medium",
			structuredOutputs: true,
		})
	}

	private systemPrompt() {
		const now = new Date().toISOString()

		return `
            You are an expert researcher. Today is ${now}. Follow these instructions when responding:
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
            - You may use high levels of speculation or prediction, just flag it for me.
        `
			.split("\n")
			.map((line) => line.trim())
			.join("\n")
	}

	private feedbackPrompt({ query, count }: { query: string; count: number }) {
		return `
            Given the following query from the user, ask some follow up questions to clarify the research direction.
            Return a maximum of ${count} questions, but feel free to return less if the original query is clear: <query>${query}</query>
        `
			.split("\n")
			.map((line) => line.trim())
			.join("\n")
	}

	private async withLoading<T>(operation: () => Promise<T>): Promise<T> {
		await this.postMessage({ type: "research.loading", text: "true" })

		try {
			return await operation()
		} finally {
			await this.postMessage({ type: "research.loading", text: "false" })
		}
	}

	public async generateFeedback({ query, count = 3 }: { query: string; count?: number }) {
		this.status = "feedback"
		this.initialQuery = query

		const schema = z.object({
			questions: z
				.array(z.string())
				.describe(`Follow up questions to clarify the research direction, max of ${count}`),
		})

		const {
			object: { questions },
		} = await this.withLoading(() =>
			generateObject({
				model: this.model,
				system: this.systemPrompt(),
				prompt: this.feedbackPrompt({ query, count }),
				schema,
			}),
		)

		this.questions = questions.slice(0, count)
	}

	private async processFeedback(content?: string) {
		if (content) {
			this.answers.push(content)
		}

		const text = this.questions.shift()

		if (text) {
			await this.postMessage({ type: "research.question", text })
		} else {
			this.combinedQuery = `
				Initial Query: ${this.initialQuery}
				Follow-up Questions and Answers:
				${this.questions.map((q: string, i: number) => `Q: ${q}\nA: ${this.answers[i]}`).join("\n")}
			`
				.split("\n")
				.map((line) => line.trim())
				.join("\n")

			await this.withLoading(() =>
				this.deepResearch({
					query: this.combinedQuery!,
					breadth: this.breadth,
					depth: this.depth,
					learnings: [],
					visitedUrls: [],
					onProgress: (progress) => {
						console.log("progress", progress)
					},
				}),
			)
		}
	}

	private async deepResearch({
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
		this.status = "research"

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
			model: this.model,
			system: this.systemPrompt(),
			query,
			learnings,
			numQueries: breadth,
		})

		reportProgress({
			totalQueries: serpQueries.length,
			currentQuery: serpQueries[0]?.query,
		})

		const limit = pLimit(this.concurrency)

		const results = await Promise.all(
			serpQueries.map((serpQuery) =>
				limit(async () => {
					try {
						const result = await firecrawl.search(serpQuery.query, {
							timeout: 15000,
							limit: 5,
							scrapeOptions: { formats: ["markdown"] },
						})

						// Collect URLs from this search.
						const newUrls = result.data
							.map((item) => item.url)
							.filter((url): url is string => url !== undefined)

						const newBreadth = Math.ceil(breadth / 2)
						const newDepth = depth - 1

						const newLearnings = await processSerpResult({
							model: this.model,
							system: this.systemPrompt(),
							query: serpQuery.query,
							result,
							numFollowUpQuestions: newBreadth,
						})

						const allLearnings = [...learnings, ...newLearnings.learnings]
						const allUrls = [...visitedUrls, ...newUrls]

						if (newDepth > 0) {
							console.log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`)

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

							return this.deepResearch({
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

							return { learnings: allLearnings, visitedUrls: allUrls }
						}
					} catch (e: any) {
						if (e.message && e.message.includes("Timeout")) {
							console.log(`Timeout error running query: ${serpQuery.query}: `, e)
						} else {
							console.log(`Error running query: ${serpQuery.query}: `, e)
						}

						return { learnings: [], visitedUrls: [] }
					}
				}),
			),
		)

		return {
			learnings: [...new Set(results.flatMap((r) => r.learnings))],
			visitedUrls: [...new Set(results.flatMap((r) => r.visitedUrls))],
		}
	}

	public async append(content: string) {
		console.log("[DeepResearchService#append] content =", content)

		switch (this.status) {
			case "idle":
				await this.generateFeedback({ query: content })
				await this.processFeedback()
				break
			case "feedback":
				await this.processFeedback()
				break
			default:
				console.log("UNHANDLED", this.status, content)
				break
		}
	}

	public async abort() {
		console.log("abort")
	}

	private postMessage(message: ExtensionMessage) {
		this.providerRef.deref()?.postMessageToWebview(message)
	}
}
