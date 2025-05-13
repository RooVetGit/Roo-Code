/**
 * Centralized text elements for prompt engineering
 *
 * This file contains shared text elements used across prompt files to ensure
 * consistency and reduce duplication.
 */

/**
 * Standard formatting instructions for tool use
 */
export const TOOL_USE_FORMAT = `Tool use is formatted using XML-style tags. Tool name and parameters are enclosed in their respective tags:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>`

/**
 * Standard description of workspace directory functionality
 */
export const WORKSPACE_DIR_EXPLANATION = `The workspace directory is the active VS Code project directory and the default directory for tool operations. New terminals start in this directory.`

/**
 * Standard warning about providing complete file content
 */
export const FILE_CONTENT_WARNING = `ALWAYS provide the COMPLETE file content without truncation or omissions. Include ALL parts of the file, even unmodified sections.`

/**
 * Standard parameter descriptions for common parameters
 */
export const PARAMETER_DESCRIPTIONS = {
	PATH: (cwd: string) => `The path relative to the workspace directory ${cwd}`,
	CONTENT: `Content to write to the file`,
	LINE: `Line number (1-based, or 0 to append to end of file)`,
}

/**
 * Standard tool use guidelines
 */
export const TOOL_USE_GUIDELINES = [
	`Assess available information and needed information using <thinking> tags`,
	`Select the most appropriate tool for your current step`,
	`Use one tool at a time, waiting for results before proceeding`,
	`Formulate tool use with the correct XML format`,
	`Always wait for user confirmation after each tool use`,
]

/**
 * Reminder about truncation errors in write_to_file operations
 */
export const TRUNCATION_REMINDER = `Include the correct line_count parameter to avoid truncation. For large files, consider using more targeted operations like insert_content or search_and_replace.`
