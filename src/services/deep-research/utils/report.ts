import { generateObject, LanguageModel } from "ai"
import { z } from "zod"

import { trimPrompt } from "./prompt"

export async function writeFinalReport({
	model,
	system,
	prompt,
	learnings,
	visitedUrls,
}: {
	model: LanguageModel
	system: string
	prompt: string
	learnings: string[]
	visitedUrls: string[]
}) {
	const learningsString = trimPrompt(
		learnings.map((learning) => `<learning>\n${learning}\n</learning>`).join("\n"),
		150_000,
	)

	const res = await generateObject({
		model,
		system,
		prompt: `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 3 or more pages, include ALL the learnings from research:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
		schema: z.object({
			reportMarkdown: z.string().describe("Final report on the topic in Markdown"),
		}),
	})

	// Append the visited URLs section to the report.
	const urlsSection = `\n\n## Sources\n\n${visitedUrls.map((url) => `- ${url}`).join("\n")}`
	return res.object.reportMarkdown + urlsSection
}
