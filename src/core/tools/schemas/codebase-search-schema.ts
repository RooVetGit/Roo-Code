import { ToolArgs } from "../../prompts/tools/types"
import { BaseToolSchema } from "./base-tool-schema"

const baseCodebaseSearchSchema: BaseToolSchema = {
	name: "codebase_search",
	description:
		"Find files most relevant to the search query. This is a semantic search tool, so the query should ask for something semantically matching what is needed. If it makes sense to only search in a particular directory, please specify it in the path parameter. Unless there is a clear reason to use your own search query, please just reuse the user's exact query with their wording. Their exact wording/phrasing can often be helpful for the semantic search query. Keeping the same exact question format can also be helpful. IMPORTANT: Queries MUST be in English. Translate non-English queries before searching.",
	parameters: [
		{
			name: "query",
			type: "string",
			description:
				"The search query to find relevant code. You should reuse the user's exact query/most recent message with their wording unless there is a clear reason not to.",
			required: true,
		},
		{
			name: "path",
			type: "string",
			description:
				"The path to the directory to search in relative to the current working directory. This parameter should only be a directory path, file paths are not supported. Defaults to the current working directory.",
			required: false,
		},
	],
}

export const codebaseSearchSchema: BaseToolSchema = {
	...baseCodebaseSearchSchema,
}
