import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { z } from "zod"

// Zod schema for MentionHandler
export const mentionHandlerSchema = z.function().args(z.string()).returns(z.promise(z.string()))

// Type inference from the schema
export type MentionHandler = z.infer<typeof mentionHandlerSchema>

// Zod schema for XmlTag
export const xmlTagSchema = z.object({
	start: z.string(),
	end: z.string(),
})

// Type inference from the schema
export type XmlTag = z.infer<typeof xmlTagSchema>

// Zod schema for MentionContext
export const mentionContextSchema = z.object({
	cwd: z.string(),
	urlContentFetcher: z.instanceof(UrlContentFetcher),
	launchBrowserError: z.instanceof(Error).optional(),
	maxReadFileLine: z.number().optional(),
})

// Type inference from the schema
export type MentionContext = z.infer<typeof mentionContextSchema>

// Zod schema for HandlerConfig
export const handlerConfigSchema = z.object({
	name: z.string(),
	test: z.function().args(z.string(), mentionContextSchema).returns(z.boolean()),
	handler: z.function().args(z.string(), mentionContextSchema).returns(z.promise(z.string())),
})

// Type inference from the schema
export type HandlerConfig = z.infer<typeof handlerConfigSchema>
