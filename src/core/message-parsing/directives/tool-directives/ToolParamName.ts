/**
 * List of parameter names that can be used in tool directives.
 */
export const toolParamNames = [
	"command",
	"path",
	"content",
	"line_count",
	"regex",
	"file_pattern",
	"recursive",
	"action",
	"url",
	"coordinate",
	"text",
	"server_name",
	"tool_name",
	"arguments",
	"uri",
	"question",
	"result",
	"diff",
	"mode_slug",
	"reason",
	"line",
	"mode",
	"message",
	"cwd",
	"follow_up",
	"task",
	"size",
	"search",
	"replace",
	"use_regex",
	"ignore_case",
	"args",
	"start_line",
	"end_line",
	"query",
] as const

/**
 * Type representing a parameter name for tool directives.
 */
export type ToolParamName = (typeof toolParamNames)[number]
