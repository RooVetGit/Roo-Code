import path from "path"
import os from "os"
import fs from "fs/promises"

import OpenAI from "openai"
import { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { zodResponseFormat } from "openai/helpers/zod"
import FirecrawlApp, { SearchResponse } from "@mendable/firecrawl-js"
import { z } from "zod"
import pLimit from "p-limit"
import * as vscode from "vscode"

import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { ResearchTaskPayload } from "../../shared/WebviewMessage"
import { ClineProvider } from "../../core/webview/ClineProvider"

import {
	ResearchInquiry,
	ResearchStep,
	ResearchProgress,
	ResearchResult,
	ResearchLearnings,
	ResearchQuery,
	ResearchTokenUsage,
	ResearchTask,
	ResearchRole,
	ResearchOutput,
	ResearchAnnotationType,
	researchLearningsSchema,
	researchQuerySchema,
	researchTaskSchema,
} from "./types"
import { RecursiveCharacterTextSplitter, encoder } from "./TextSplitter"

type DeepResearchServiceStatus = "idle" | "followUp" | "research" | "done" | "aborted"

export class DeepResearchService {
	public readonly taskId: string
	public readonly providerId: string
	public readonly providerApiKey: string
	public readonly firecrawlApiKey: string
	public readonly modelId: string
	public readonly breadth: number
	public readonly depth: number
	public readonly concurrency: number

	private providerRef: WeakRef<ClineProvider>
	private firecrawl: FirecrawlApp
	private openai: OpenAI
	private _status: DeepResearchServiceStatus = "idle"

	private inquiry: ResearchInquiry = { followUps: [], responses: [] }
	private progress: ResearchProgress = { expectedQueries: 0, completedQueries: 0, progressPercentage: 0 }

	private tokenUsage: ResearchTokenUsage = { inTokens: 0, outTokens: 0, totalTokens: 0 }
	private output: ResearchOutput[] = []
	private messages: ChatCompletionMessageParam[] = []

	constructor(
		{
			providerId,
			providerApiKey,
			firecrawlApiKey,
			modelId,
			breadth,
			depth,
			concurrency,
		}: ResearchTaskPayload["session"],
		clineProvider: ClineProvider,
	) {
		this.taskId = crypto.randomUUID()
		this.providerId = providerId
		this.providerApiKey = providerApiKey
		this.firecrawlApiKey = firecrawlApiKey
		this.modelId = modelId
		this.breadth = breadth
		this.depth = depth
		this.concurrency = concurrency

		this.providerRef = new WeakRef(clineProvider)

		this.firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey })

		this.openai = new OpenAI({
			baseURL: providerId === "openrouter" ? "https://openrouter.ai/api/v1" : undefined,
			apiKey: providerApiKey,
		})
	}

	/**
	 * Prompts
	 */

	private researchSystemPrompt() {
		const now = new Date().toISOString()

		return this.trimPrompt(`
            You are an expert researcher. Today is ${now}. Follow these instructions when responding:
            - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
            - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
            - Be highly organized.
            - Suggest solutions that the user didn't think about.
            - Be proactive and anticipate the user's needs.
            - Treat the user as an expert in all subject matter.
            - Mistakes erode the user's trust, so be accurate and thorough.
            - Provide detailed explanations, the user is comfortable with lots of detail.
            - Value good arguments over authorities, the source is irrelevant.
            - Consider new technologies and contrarian ideas, not just the conventional wisdom.
            - You may use high levels of speculation or prediction, just flag it for the user.
        `)
	}

	private chatSystemPrompt() {
		const now = new Date().toISOString()

		return this.trimPrompt(`
			You are an expert research assistant helping to explain and clarify research findings. Today is ${now}. Follow these guidelines:

			- You always answer with markdown formatting. You will be penalized if you do not answer with markdown when it would be possible.
			- The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes.
			- You do not support images and never include images. You will be penalized if you render images.
			- You also support Mermaid formatting. You will be penalized if you do not render Mermaid diagrams when it would be possible.
			- The Mermaid diagrams you support: sequenceDiagram, flowChart, classDiagram, stateDiagram, erDiagram, gantt, journey, gitGraph, pie.
			- Reference specific findings from the research when answering.
			- Be precise and detailed in explanations.
			- If asked about something outside the research scope, acknowledge this and stick to what was actually researched.
			- Feel free to make connections between different parts of the research.
			- When speculating or making inferences beyond the direct research, clearly label these as such.
			- If asked about sources, refer to the URLs provided in the research.
			- Maintain a professional, analytical tone.
			- Never include images in responses.
		`)
	}

	/**
	 * LLM
	 */

	public async generateFollowUps({ query, count = 3 }: { query: string; count?: number }) {
		console.log(`[generateFollowUps] generating up to ${count} follow-up questions`)

		const prompt = this.trimPrompt(`
            Given the following query from the user, ask some follow up questions to clarify the research direction.
            Return a maximum of ${count} questions, but return less if the original query is clear.
			Make sure each question is unique and not similar to each other.
			Don't overly burden the user with questions; use your best judgement to determine only the most important questions.
			<query>${query}</query>
        `)

		const schema = z.object({
			questions: z
				.array(z.string())
				.describe(`Follow up questions to clarify the research direction, max of ${count}`),
		})

		try {
			const completion = await this.withLoading(
				this.openai.beta.chat.completions.parse({
					model: this.modelId,
					messages: [
						{ role: "system", content: this.researchSystemPrompt() },
						{ role: "user", content: prompt },
					],
					response_format: zodResponseFormat(schema, "schema"),
				}),
				"Clarifying...",
			)

			const questions = completion.choices[0].message.parsed?.questions ?? []
			console.log(`[generateFollowUps] generated ${questions.length} follow-up questions`, questions)
			return questions
		} catch (error) {
			await this.publishMessage({
				type: "research.error",
				text: error instanceof Error ? error.message : "Unknown error.",
			})

			await this.abort()
			return []
		}
	}

	private async generateQueries({
		query,
		breadth,
		learnings,
	}: {
		query: string
		breadth: number
		learnings?: string[]
	}): Promise<ResearchQuery[]> {
		console.log(`[generateQueries] generating up to ${breadth} queries`)

		const prompt = this.trimPrompt(`
			Given the following prompt from the user, generate a list of SERP queries to research the topic.
			Return a maximum of ${breadth} queries, but feel free to return less if the original prompt is clear.
			Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>
		
			${learnings ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join("\n")}` : ""}
		`)

		const schema = z
			.object({
				queries: z.array(
					researchQuerySchema.extend({
						query: researchQuerySchema.shape.query.describe("The SERP query"),
						researchGoal: researchQuerySchema.shape.query.describe(
							"First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.",
						),
					}),
				),
			})
			.describe(`List of SERP queries, max of ${breadth}`)

		try {
			const completion = await this.openai.beta.chat.completions.parse({
				model: this.modelId,
				messages: [
					{ role: "system", content: this.researchSystemPrompt() },
					{ role: "user", content: prompt },
				],
				response_format: zodResponseFormat(schema, "schema"),
			})

			await this.updateTokenUsage(completion.usage)
			const queries = completion.choices[0].message.parsed?.queries ?? []
			console.log(`[generateQueries] generated ${queries.length} (out of ${breadth}) queries`, queries)
			return queries
		} catch (error) {
			await this.publishMessage({
				type: "research.error",
				text: error instanceof Error ? error.message : "Unknown error.",
			})

			await this.abort()
			return []
		}
	}

	private async generateLearnings({
		query,
		result,
		breadth,
		learningsCount = 3,
	}: {
		query: string
		result: SearchResponse
		breadth: number
		learningsCount?: number
	}): Promise<ResearchLearnings> {
		const contents = result.data
			.map((item) => item.markdown)
			.filter((content) => content !== undefined)
			.map((content) => this.truncatePrompt(content, 25_000))

		console.log(`[generateLearnings] extracting learnings from "${query}"`)

		const prompt = this.trimPrompt(`
			Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents.
			Return a maximum of ${learningsCount} learnings, but feel free to return less if the contents are clear.
			Make sure each learning is unique and not similar to each other.
			The learnings should be concise and to the point, as detailed and information dense as possible.
			Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates.
			The learnings will be used to research the topic further.

			<contents>${contents.map((content) => `<content>\n${content}\n</content>`).join("\n")}</contents>
		`)

		const schema = researchLearningsSchema.extend({
			learnings: researchLearningsSchema.shape.learnings.describe(
				`List of learnings from the contents, max of ${learningsCount}`,
			),
			followUpQuestions: researchLearningsSchema.shape.followUpQuestions.describe(
				`List of follow-up questions to research the topic further, max of ${breadth}`,
			),
		})

		try {
			const completion = await this.openai.beta.chat.completions.parse({
				model: this.modelId,
				messages: [
					{ role: "system", content: this.researchSystemPrompt() },
					{ role: "user", content: prompt },
				],
				response_format: zodResponseFormat(schema, "schema"),
			})

			await this.updateTokenUsage(completion.usage)
			const parsed = completion.choices[0].message.parsed
			const learnings = parsed?.learnings ?? []
			const followUpQuestions = parsed?.followUpQuestions ?? []
			console.log(`[generateLearnings] extracted ${learnings.length} learnings`, learnings)
			return { learnings, followUpQuestions }
		} catch (error) {
			await this.publishMessage({
				type: "research.error",
				text: error instanceof Error ? error.message : "Unknown error.",
			})

			await this.abort()
			return { learnings: [], followUpQuestions: [] }
		}
	}

	private async generateReport({ learnings, visitedUrls }: { learnings: string[]; visitedUrls: string[] }) {
		const learningsString = this.truncatePrompt(
			learnings.map((learning) => `<learning>\n${learning}\n</learning>`).join("\n"),
			150_000,
		)

		const prompt = this.trimPrompt(`
			Given the following prompt from the user, write a final report on the topic using the learnings from research.
			Make it as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:

			<prompt>${this.inquiry!.query}</prompt>

			Here are all the learnings from previous research:

			<learnings>
			${learningsString}
			</learnings>
		`)

		const schema = z.object({
			reportMarkdown: z.string().describe("Final report on the topic in Markdown"),
		})

		const completion = await this.openai.beta.chat.completions.parse({
			model: this.modelId,
			messages: [
				{ role: "system", content: this.researchSystemPrompt() },
				{ role: "user", content: prompt },
			],
			response_format: zodResponseFormat(schema, "schema"),
		})

		await this.updateTokenUsage(completion.usage)
		const parsed = completion.choices[0].message.parsed
		const reportMarkdown = parsed?.reportMarkdown ?? ""
		return reportMarkdown + `\n\n## Sources\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`
	}

	private async generateChatCompletion() {
		try {
			const completion = await this.openai.beta.chat.completions.stream({
				model: this.modelId,
				messages: this.messages,
			})

			let buffer = ""
			let usage: OpenAI.CompletionUsage | undefined

			for await (const chunk of completion) {
				buffer += chunk.choices[0]?.delta?.content || ""

				if (chunk.usage) {
					usage = chunk.usage
				}
			}

			await this.updateTokenUsage(usage)
			return buffer
		} catch (error) {
			const text = error instanceof Error ? error.message : "Unknown error."
			console.log(`[generateChatCompletion] error = ${text}`)
			await this.publishMessage({ type: "research.error", text })
			return undefined
		}
	}

	/**
	 * Deep Research
	 */

	private async runDeepResearch() {
		this.status = "research"

		const query = this.trimPrompt(`
			Initial Query: ${this.inquiry.initialQuery}

			Follow-up Questions and Answers:
			${this.inquiry.followUps.map((followUp, index) => `Q: ${followUp}\nA: ${this.inquiry.responses[index]}`).join("\n\n")}
		`)

		this.inquiry.query = query

		const onProgressUpdated = () => {
			const { expectedQueries, completedQueries } = this.progress
			this.progress.progressPercentage = Math.round((completedQueries / expectedQueries) * 100)
			this.publishMessage({ type: "research.progress", text: JSON.stringify(this.progress) })
		}

		const onGeneratedQueries = (queries: ResearchQuery[]) =>
			this.publishOutput({
				role: ResearchRole.Assistant,
				content: `Generated ${queries.length} topics to research.\n\n${queries.map(({ query }) => `- ${query}`).join("\n")}`,
				annotations: [
					{
						type: ResearchAnnotationType.Badge,
						data: { label: "Idea", variant: "outline" },
					},
				],
			})

		const onExtractedLearnings = (learnings: ResearchLearnings & { urls: string[] }) =>
			this.publishOutput({
				role: ResearchRole.Assistant,
				content: `Extracted ${learnings.learnings.length} learnings from ${learnings.urls.length} sources.\n\n${learnings.urls.map((url) => `- ${url}`).join("\n")}`,
				annotations: [
					{
						type: ResearchAnnotationType.Badge,
						data: { label: "Learning", variant: "outline" },
					},
				],
			})

		this.progress.expectedQueries = this.getTreeSize({ breadth: this.breadth, depth: this.depth })
		onProgressUpdated()

		console.log(`[transitionToResearch] query = ${query}`)
		console.log(`[transitionToResearch] breadth = ${this.breadth}`)
		console.log(`[transitionToResearch] depth = ${this.depth}`)
		console.log(`[transitionToResearch] expectedQueries = ${this.progress.expectedQueries}`)

		const { learnings, visitedUrls } = await this.withLoading(
			this.deepResearch({
				query,
				breadth: this.breadth,
				depth: this.depth,
				learnings: [],
				visitedUrls: [],
				onProgressUpdated,
				onGeneratedQueries,
				onExtractedLearnings,
			}),
			"Researching...",
		)

		if (this.isAborted()) {
			return
		}

		this.inquiry.learnings = learnings
		this.inquiry.urls = visitedUrls

		const report = await this.withLoading(this.generateReport({ learnings, visitedUrls }), "Summarizing...")
		this.inquiry.report = report

		await this.viewReport()

		await this.publishOutput({
			role: ResearchRole.Assistant,
			content: report,
			annotations: [{ type: ResearchAnnotationType.Badge, data: { label: "Completed", variant: "default" } }],
		})

		this.messages.push({
			role: "system",
			content: this.trimPrompt(`
				${this.chatSystemPrompt()}

				Here is the complete research context:
				${this.inquiry.query}

				Research Process:
				- Depth: ${this.depth}
				- Breadth: ${this.breadth}

				Intermediate Research Learnings:
				${this.inquiry.learnings?.map((learning) => `- ${learning}`).join("\n")}

				URLs Visited:
				${this.inquiry.urls?.map((url) => `- ${url}`).join("\n")}

				Final Research Report:
				${this.inquiry.report}
			`),
		})

		this.status = "done"

		setTimeout(async () => {
			const content = "I'm available to answer any questions you might have about the detailed report above."
			this.messages.push({ role: "assistant", content })

			await this.publishOutput({
				role: ResearchRole.Assistant,
				content,
				annotations: [{ type: ResearchAnnotationType.Badge, data: { label: "👋", variant: "outline" } }],
			})
		}, 1000)
	}

	private async deepResearch({
		query,
		breadth,
		depth,
		learnings = [],
		visitedUrls = [],
		onProgressUpdated,
		onGeneratedQueries,
		onExtractedLearnings,
	}: ResearchStep): Promise<ResearchResult> {
		if (this.isAborted()) {
			return { learnings, visitedUrls }
		}

		const queries = await this.generateQueries({ query, learnings, breadth })
		onGeneratedQueries(queries)

		if (queries.length < breadth) {
			const delta = breadth - queries.length
			this.progress.expectedQueries = this.progress.expectedQueries - delta
			console.log(`[deepResearch] expectedQueries reduced by ${delta} to ${this.progress.expectedQueries}`)
			onProgressUpdated()
		}

		const limit = pLimit(this.concurrency)

		const results = await Promise.all(
			queries.map(({ query, researchGoal }) =>
				limit(async () => {
					if (this.isAborted()) {
						return { learnings, visitedUrls }
					}

					let result: SearchResponse

					try {
						result = await this.firecrawl.search(query, {
							timeout: 15000,
							limit: 5,
							scrapeOptions: { formats: ["markdown"] },
						})
					} catch (e) {
						const text = e instanceof Error ? e.message : "Unknown error"
						console.log(`[deepResearch] error = ${text}`)

						await this.publishMessage({
							type: "research.error",
							text: `Encountered an error while crawling "${query}": ${text}`,
						})

						return { learnings, visitedUrls }
					}

					const newUrls = result.data.map(({ url }) => url).filter((url): url is string => url !== undefined)

					const newBreadth = Math.ceil(breadth / 2)
					const newDepth = depth - 1
					let newLearnings: ResearchLearnings

					try {
						newLearnings = await this.generateLearnings({ query, result, breadth: newBreadth })
					} catch (e) {
						const text = e instanceof Error ? e.message : "Unknown error"
						console.log(`[deepResearch] error = ${text}`)

						await this.publishMessage({
							type: "research.error",
							text: `Encountered an error while extracting learnings from "${query}": ${text}`,
						})

						return { learnings, visitedUrls }
					}

					const allLearnings = [...learnings, ...newLearnings.learnings]
					const allUrls = [...visitedUrls, ...newUrls]
					onExtractedLearnings({ ...newLearnings, urls: newUrls })

					this.progress.completedQueries = this.progress.completedQueries + 1
					onProgressUpdated()

					if (newDepth <= 0) {
						return { learnings: allLearnings, visitedUrls: allUrls }
					}

					console.log(`[deepResearch] researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`)

					const nextQuery = this.trimPrompt(`
						Previous research goal: ${researchGoal}
						Follow-up research directions: ${newLearnings.followUpQuestions.map((q) => `\n${q}`).join("")}
					`)

					return this.deepResearch({
						query: nextQuery,
						breadth: newBreadth,
						depth: newDepth,
						learnings: allLearnings,
						visitedUrls: allUrls,
						onProgressUpdated,
						onGeneratedQueries,
						onExtractedLearnings,
					})
				}),
			),
		)

		return {
			learnings: [...new Set(results.flatMap((r) => r.learnings))],
			visitedUrls: [...new Set(results.flatMap((r) => r.visitedUrls))],
		}
	}

	/**
	 * Events
	 *
	 * idle -> feedback -> research -> done -> aborted
	 */

	public async input(content: string) {
		if (this.isAborted()) {
			this.publishMessage({ type: "research.error", text: "Deep research task has ended." })
			return
		}

		this.output.push({ role: "user", content })

		const stateHandlers = {
			idle: () => this.handleIdle(content),
			followUp: () => this.handleFollowUp(content),
			research: () => console.log("NOOP", content),
			done: () => this.handleDone(content),
			aborted: () => console.log("NOOP", content),
		} as const

		console.log(`[DeepResearchService#append] executing ${this.status} handler with content = "${content}"`)
		await stateHandlers[this.status]()
	}

	private async handleIdle(query: string) {
		this.status = "followUp"
		this.inquiry = { initialQuery: query, followUps: [], responses: [] }
		this.inquiry.followUps = await this.generateFollowUps({ query })
		await this.handleFollowUp(null)
	}

	private async handleFollowUp(content: string | null) {
		if (content) {
			this.inquiry.responses.push(content)
		}

		this.inquiry.responses.length >= this.inquiry.followUps.length
			? await this.runDeepResearch()
			: await this.publishOutput({
					role: ResearchRole.Assistant,
					content: this.inquiry.followUps[this.inquiry.responses.length],
					annotations: [
						{ type: ResearchAnnotationType.Badge, data: { label: "Follow Up", variant: "outline" } },
					],
				})
	}

	private async handleDone(content: string) {
		this.messages.push({ role: "user", content })
		const response = await this.withLoading(this.generateChatCompletion())

		if (response) {
			await this.publishOutput({ role: ResearchRole.Assistant, content: response })
		}
	}

	/**
	 * Statuses
	 */

	public isAborted() {
		return this.status === "aborted"
	}

	private get status() {
		return this._status
	}

	private set status(value: DeepResearchServiceStatus) {
		if (this.isAborted()) {
			return
		}

		console.log(`[setStatus] ${this.status} -> ${value}`)
		this.publishMessage({ type: "research.status", text: JSON.stringify({ status: value }) })
		this._status = value
	}

	/**
	 * Actions
	 */

	public async abort() {
		this.status = "aborted"
		await this.saveResearchTask()
	}

	public async viewReport() {
		const document = await this.upsertReport()
		await vscode.window.showTextDocument(document, { preview: false })
	}

	public async createTask() {
		const provider = this.providerRef.deref()

		if (!provider) {
			return
		}

		const document = await this.upsertReport()

		if (provider) {
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })

			const mentionPath = vscode.workspace.workspaceFolders?.[0]
				? `/${vscode.workspace.asRelativePath(document.uri)}`
				: document.uri.fsPath

			await provider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: `@${mentionPath}`,
			})
		}
	}

	public static async getTasks(globalStoragePath: string) {
		try {
			const rootDir = path.join(globalStoragePath, "research")
			const taskDirs = await fs.readdir(rootDir)

			const tasks = await Promise.all(
				taskDirs.map(async (taskDir) => {
					try {
						const contents = await fs.readFile(path.join(rootDir, taskDir, "task.json"), "utf-8")
						const result = researchTaskSchema.safeParse(JSON.parse(contents))
						return result.success ? result.data : null
					} catch (e) {
						console.error(`[getTasks] failed to load ${taskDir}:`, e)
						return null
					}
				}),
			)

			return tasks.filter((task): task is ResearchTask => task !== null)
		} catch (e) {
			console.error("[getTasks] unexpected error", e)
			return []
		}
	}

	public static async getTask(globalStoragePath: string, taskId: string) {
		try {
			const filepath = path.join(globalStoragePath, "research", taskId, "task.json")
			const contents = await fs.readFile(filepath, "utf-8")
			const result = researchTaskSchema.safeParse(JSON.parse(contents))
			return result.success ? result.data : undefined
		} catch (e) {
			console.error("[getTask] unexpected error", e)
			return []
		}
	}

	public static async deleteTask(globalStoragePath: string, taskId: string) {
		const filepath = path.join(globalStoragePath, "research", taskId, "task.json")
		await fs.unlink(filepath)
		await fs.rmdir(path.join(globalStoragePath, "research", taskId), { recursive: true })
	}

	/**
	 * Helpers
	 */

	private async withLoading<T>(promise: Promise<T>, message?: string): Promise<T> {
		await this.publishMessage({ type: "research.loading", text: JSON.stringify({ message, isLoading: true }) })

		try {
			return await promise
		} finally {
			await this.publishMessage({ type: "research.loading", text: JSON.stringify({ message, isLoading: false }) })
		}
	}

	private async publishOutput(output: ResearchOutput) {
		const isPublished = await this.publishMessage({ type: "research.output", text: JSON.stringify(output) })

		if (isPublished) {
			this.output.push(output)
			await this.saveResearchTask()
		}
	}

	private async publishMessage(message: ExtensionMessage) {
		if (this.isAborted() && message.type === "research.output") {
			return false
		}

		await this.providerRef.deref()?.postMessageToWebview(message)
		return true
	}

	private async upsertReport() {
		let document: vscode.TextDocument | undefined = undefined

		if (this.inquiry.fileUri) {
			try {
				return await vscode.workspace.openTextDocument(this.inquiry.fileUri)
			} catch (error) {
				console.log(`[saveReport] unable to open ${this.inquiry.fileUri}`)
			}
		}

		const fileName = `Deep-Research-${Date.now()}.md`
		const workspaceFolders = vscode.workspace.workspaceFolders
		const folderUri = workspaceFolders?.[0]?.uri || vscode.Uri.file(path.join(os.tmpdir(), fileName))
		const fileUri = vscode.Uri.joinPath(folderUri, fileName)

		console.log(`[upsertReport] saving to ${fileUri.fsPath}`)

		try {
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(this.inquiry.report ?? ""))
			document = await vscode.workspace.openTextDocument(fileUri)
			this.inquiry.fileUri = fileUri.fsPath
		} catch (error) {
			console.log(`[upsertReport] unable to save to ${fileUri.fsPath}, falling back to buffer`)
			document = await vscode.workspace.openTextDocument({ content: this.inquiry.report, language: "markdown" })
		}

		return document
	}

	private async updateTokenUsage(usage: OpenAI.CompletionUsage | null | undefined) {
		if (!usage) {
			return
		}

		this.tokenUsage = {
			inTokens: this.tokenUsage.inTokens + (usage.prompt_tokens ?? 0),
			outTokens: this.tokenUsage.outTokens + (usage.completion_tokens ?? 0),
			totalTokens: this.tokenUsage.totalTokens + (usage.total_tokens ?? 0),
		}

		await this.publishMessage({ type: "research.tokenUsage", text: JSON.stringify(this.tokenUsage) })
	}

	private trimPrompt(prompt: string) {
		return prompt
			.split("\n")
			.map((line) => line.trim())
			.join("\n")
	}

	private truncatePrompt(prompt: string, contextSize = 128_000, minChunkSize = 140): string {
		if (!prompt) {
			return ""
		}

		const length = encoder.encode(prompt).length

		if (length <= contextSize) {
			return prompt
		}

		const overflowTokens = length - contextSize

		// On average it's 3 characters per token, so multiply by 3 to get a rough
		// estimate of the number of characters.
		const chunkSize = prompt.length - overflowTokens * 3

		if (chunkSize < minChunkSize) {
			return prompt.slice(0, minChunkSize)
		}

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize,
			chunkOverlap: 0,
		})

		const truncated = splitter.splitText(prompt)[0] ?? ""

		// Last catch, there's a chance that the trimmed prompt is same length as
		// the original prompt, due to how tokens are split & innerworkings of the
		// splitter, handle this case by just doing a hard cut.
		if (truncated.length === prompt.length) {
			return this.truncatePrompt(prompt.slice(0, chunkSize), contextSize, minChunkSize)
		}

		// Recursively trim until the prompt is within the context size.
		return this.truncatePrompt(truncated, contextSize, minChunkSize)
	}

	// Calculate total expected queries across all depth levels.
	// At each level, the breadth is halved, so level 1 has full breadth,
	// level 2 has breadth/2, level 3 has breadth/4, etc.
	// For breadth = 4, depth = 2, the expected queries are:
	// D2: 2^2 * 1 = 4
	// D1: 2^1 * 2 = 4
	// D0: 2^0 * 4 = 4
	// Total: 12
	private getTreeSize = ({ breadth, depth }: { breadth: number; depth: number }) => {
		let value = 0

		for (let i = depth; i >= 0; i--) {
			value = value + Math.pow(2, i) * Math.ceil(breadth / Math.pow(2, i))
		}

		return value
	}

	private async ensureResearchTasksDirectoryExists() {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath

		if (!globalStoragePath) {
			throw new Error("Global storage path is invalid.")
		}

		const dir = path.join(globalStoragePath, "research", this.taskId)
		await fs.mkdir(dir, { recursive: true })
		return dir
	}

	private async saveResearchTask() {
		const task: ResearchTask = {
			taskId: this.taskId,
			providerId: this.providerId,
			modelId: this.modelId,
			breadth: this.breadth,
			depth: this.depth,
			concurrency: this.concurrency,
			inquiry: this.inquiry,
			output: this.output,
			messages: this.messages,
			createdAt: Date.now(),
		}

		const dir = await this.ensureResearchTasksDirectoryExists()
		await fs.writeFile(path.join(dir, "task.json"), JSON.stringify(task))
	}
}
