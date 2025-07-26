import { ToolArgs } from "./types"

export function getApplyCodeDescription(args: ToolArgs): string {
	return `## apply_code
Description: Request to apply code changes using a two-stage approach for improved reliability. This tool first generates code based on your instruction, then creates an accurate diff to integrate it into the existing file. This approach separates creative code generation from technical diff creation, resulting in more reliable code modifications.

Parameters:
- path: (required) The path of the file to modify (relative to the current workspace directory ${args.cwd})
- instruction: (required) Clear instruction describing what code changes to make

Usage:
<apply_code>
<path>File path here</path>
<instruction>Your instruction for code changes</instruction>
</apply_code>

Example: Adding a new function to an existing file
<apply_code>
<path>src/utils.ts</path>
<instruction>Add a function called calculateAverage that takes an array of numbers and returns their average</instruction>
</apply_code>

Example: Modifying existing code
<apply_code>
<path>src/api/handler.ts</path>
<instruction>Update the error handling in the fetchData function to include retry logic with exponential backoff</instruction>
</apply_code>

Benefits over apply_diff:
- More reliable: Separates code generation from diff creation
- Cleaner context: Each stage has focused, minimal context
- Better success rate: Reduces failures due to inaccurate diffs
- Natural instructions: Use plain language instead of crafting diffs`
}
