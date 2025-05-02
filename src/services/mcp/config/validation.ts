import { z } from "zod"
import { ServerConfig } from "../types"
import * as vscode from "vscode"

const typeErrorMessage = "Server type must match the provided configuration"

const BaseConfigSchema = z.object({
	disabled: z.boolean().optional(),
	timeout: z.number().optional(),
	alwaysAllow: z.array(z.string()).optional(),
	watchPaths: z.array(z.string()).optional(),
})

const createServerConfigSchema = () => {
	return z.union([
		// Stdio config (has command field)
		BaseConfigSchema.extend({
			type: z.enum(["stdio"]).optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			cwd: z.string().default(() => vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? process.cwd()),
			env: z.record(z.string()).optional(),
			// Ensure no HTTP fields are present
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
			sessionId: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "stdio" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "stdio", { message: typeErrorMessage }),

		// SSE config (has url field)
		BaseConfigSchema.extend({
			type: z.enum(["sse"]).optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			sessionId: z.undefined().optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			cwd: z.undefined().optional(),
			env: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "sse" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "sse", { message: typeErrorMessage }),

		// Streamable HTTP config (has url field and optional sessionId)
		BaseConfigSchema.extend({
			type: z.enum(["streamable-http"]).optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			sessionId: z.string().optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			cwd: z.undefined().optional(),
			env: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "streamable-http" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "streamable-http", {
				message: typeErrorMessage,
			}),
	])
}

/**
 * Validates a server configuration object.
 * @param config The configuration object to validate
 * @returns The validated server configuration
 * @throws {ZodError} If validation fails
 */
export const validateServerConfig = (config: unknown): ServerConfig => {
	return createServerConfigSchema().parse(config)
}

/**
 * Safely validates a server configuration object.
 * @param config The configuration object to validate
 * @returns The validation result
 */
export const safeParseServerConfig = (config: unknown): z.SafeParseReturnType<unknown, ServerConfig> => {
	return createServerConfigSchema().safeParse(config)
}
