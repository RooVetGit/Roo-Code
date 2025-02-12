import { SearchResponse } from "@mendable/firecrawl-js"
import { generateObject, LanguageModel } from "ai"
import { z } from "zod"

import { trimPrompt } from "./prompt"

type SerpOptions = {
	model: LanguageModel
	system: string
	query: string
}

type GenerateSerpQueries = SerpOptions & {
	numQueries?: number
	learnings?: string[] // Optional, if provided, the research will continue from the last learning.
}

export async function generateSerpQueries({ model, system, query, numQueries = 3, learnings }: GenerateSerpQueries) {
	const res = await generateObject({
		model,
		system,
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

	console.log(`Created ${res.object.queries.length} queries`, res.object.queries)

	return res.object.queries.slice(0, numQueries)
}

type ProcessSerpResult = SerpOptions & {
	result: SearchResponse
	numLearnings?: number
	numFollowUpQuestions?: number
}

export async function processSerpResult({
	model,
	system,
	query,
	result,
	numLearnings = 3,
	numFollowUpQuestions = 3,
}: ProcessSerpResult) {
	const contents = result.data
		.map((item) => item.markdown)
		.filter((content) => content !== undefined)
		.map((content) => trimPrompt(content, 25_000))

	console.log(`Ran ${query}, found ${contents.length} contents`)

	const res = await generateObject({
		model,
		system,
		prompt: `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
			.map((content) => `<content>\n${content}\n</content>`)
			.join("\n")}</contents>`,
		schema: z.object({
			learnings: z.array(z.string()).describe(`List of learnings, max of ${numLearnings}`),
			followUpQuestions: z
				.array(z.string())
				.describe(`List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`),
		}),
		abortSignal: AbortSignal.timeout(60_000),
	})

	console.log(`Created ${res.object.learnings.length} learnings`, res.object.learnings)

	return res.object
}
