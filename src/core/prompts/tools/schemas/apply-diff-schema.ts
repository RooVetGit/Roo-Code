import { ToolArgs } from "../types"
import { BaseToolSchema } from "./base-tool-schema"

export function generateApplyDiffSchema(args: ToolArgs): BaseToolSchema {
	const schema: BaseToolSchema = {
		name: "apply_diff",
		description:
			"Applies PRECISE, TARGETED modifications to one or more files by searching for and replacing specific content blocks. Ideal for surgical code edits. Supports modifications across multiple files in a single operation.",
		parameters: [
			{
				name: "args",
				type: "object",
				description: "Container for the file modification arguments.",
				required: true,
				properties: {
					file: {
						name: "file",
						type: "array",
						description:
							"An array of file modification objects. Apply changes to multiple files in a single call to maximize efficiency.",
						required: true,
						items: {
							name: "fileItem",
							type: "object",
							description: "A file modification object containing the path and diff operations.",
							required: true,
							properties: {
								path: {
									name: "path",
									type: "string",
									description: "The relative path to the file that needs to be modified.",
									required: true,
								},
								diff: {
									name: "diff",
									type: "array",
									description:
										"An array of diff operations to be applied to the file. CRITICAL: For efficiency, include a large surrounding context (3-5 lines above and below) to combine multiple nearby changes into one operation instead of creating separate diffs for each line.",
									required: true,
									items: {
										name: "diffItem",
										type: "object",
										description: "A single search-and-replace operation.",
										required: true,
										properties: {
											search: {
												name: "search",
												type: "string",
												description:
													"The exact multi-line block of content to search for in the file. MUST match the original file content exactly (including all whitespace, indentation, tabs, and line breaks). Copy the exact text from the original file with perfect whitespace preservation.",
												required: true,
											},
											replace: {
												name: "replace",
												type: "string",
												description:
													"The new multi-line content that will replace the search block. Preserve the original indentation structure and include all the context lines from the search block, making only the necessary changes to the target lines. This should be the complete replacement for the entire search block.",
												required: true,
											},
											start_line: {
												name: "start_line",
												type: "number",
												description:
													"The starting line number of the 'search' block. Required when applying multiple diffs to a single file.",
												required: false,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		],
		systemPrompt: `## apply_diff

Description: Request to apply PRECISE, TARGETED modifications to one or more files by searching for specific sections of content and replacing them. This tool is for SURGICAL EDITS ONLY - specific changes to existing code. This tool supports both single-file and multi-file operations, allowing you to make changes across multiple files in a single request.

**IMPORTANT: You MUST use multiple files in a single operation whenever possible to maximize efficiency and minimize back-and-forth.**

You can perform multiple distinct search and replace operations within a single \`apply_diff\` call by providing multiple SEARCH/REPLACE blocks in the \`diff\` parameter. This is the preferred way to make several targeted changes efficiently.

The SEARCH section must exactly match existing content including whitespace and indentation.
If you're not confident in the exact content to search for, use the read_file tool first to get the exact content.
When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file.
ALWAYS make as many changes in a single 'apply_diff' request as possible using multiple SEARCH/REPLACE blocks

Parameters:
- args: Contains one or more file elements, where each file contains:
  - path: (required) The path of the file to modify (relative to the current workspace directory ${args.cwd})
  - diff: (required) One or more diff elements containing:
    - content: (required) The search/replace block defining the changes.
    - start_line: (required) The line number of original content where the search block starts.

Diff format:
\`\`\`
<<<<<<< SEARCH
:start_line: (required) The line number of original content where the search block starts.
-------
[exact content to find including whitespace]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

Example:

Original file:
\`\`\`
1 | def calculate_total(items):
2 |     total = 0
3 |     for item in items:
4 |         total += item
5 |     return total
\`\`\`

Search/Replace content:
<apply_diff>
<args>
<file>
  <path>eg.file.py</path>
  <diff>
    <content><![CDATA[
<<<<<<< SEARCH
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE
]]></content>
  </diff>
</file>
</args>
</apply_diff>

Search/Replace content with multi edits across multiple files:
<apply_diff>
<args>
<file>
  <path>eg.file.py</path>
  <diff>
    <content><![CDATA[
<<<<<<< SEARCH
def calculate_total(items):
    sum = 0
=======
def calculate_sum(items):
    sum = 0
>>>>>>> REPLACE
]]></content>
  </diff>
  <diff>
    <content><![CDATA[
<<<<<<< SEARCH
        total += item
    return total
=======
        sum += item
    return sum 
>>>>>>> REPLACE
]]></content>
  </diff>
</file>
<file>
  <path>eg.file2.py</path>
  <diff>
    <content><![CDATA[
<<<<<<< SEARCH
def greet(name):
    return "Hello " + name
=======
def greet(name):
    return f"Hello {name}!"
>>>>>>> REPLACE
]]></content>
  </diff>
</file>
</args>
</apply_diff>


Usage:
<apply_diff>
<args>
<file>
  <path>File path here</path>
  <diff>
    <content>
Your search/replace content here
You can use multi search/replace block in one diff block, but make sure to include the line numbers for each block.
Only use a single line of '=======' between search and replacement content, because multiple '=======' will corrupt the file.
    </content>
    <start_line>1</start_line>
  </diff>
</file>
<file>
  <path>Another file path</path>
  <diff>
    <content>
Another search/replace content here
You can apply changes to multiple files in a single request.
Each file requires its own path, start_line, and diff elements.
    </content>
    <start_line>5</start_line>
  </diff>
</file>
</args>
</apply_diff>`,
	}

	return schema
}
