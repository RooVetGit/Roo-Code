import { z } from "zod"

export type ChatHandler = {
	isDisabled?: boolean
	setIsDisabled?: (isDisabled: boolean) => void

	isLoading: boolean
	setIsLoading?: (isLoading: boolean) => void

	loadingMessage?: string
	setLoadingMessage?: (message: string) => void

	input: string
	setInput: (input: string) => void

	messages: Message[]
	append: (message: Message, options?: { data?: any }) => Promise<string | null | undefined>

	reload?: (options?: { data?: any }) => void
	stop?: () => void
	reset?: () => void
}

/**
 * Message Annotation
 */

export enum MessageAnnotationType {
	Badge = "badge",
}

export const messageAnnotationSchema = z.object({
	type: z.nativeEnum(MessageAnnotationType),
	data: z.object({
		label: z.string(),
		variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
	}),
})

export type MessageAnnotation = z.infer<typeof messageAnnotationSchema>

/**
 * Message
 */

export enum MessageRole {
	System = "system",
	User = "user",
	Assistant = "assistant",
}

export const messageSchema = z.object({
	role: z.nativeEnum(MessageRole),
	content: z.string(),
	annotations: z.array(messageAnnotationSchema).optional(),
})

export type Message = z.infer<typeof messageSchema>
