export interface Message {
	role: "system" | "user" | "assistant" | "data"
	content: string
	annotations?: any
}

export type ChatHandler = {
	isInitialized: boolean

	isLoading: boolean
	setIsLoading: (isLoading: boolean) => void

	input: string
	setInput: (input: string) => void

	messages: Message[]

	reload?: (chatRequestOptions?: { data?: any }) => void
	stop?: () => void
	append: (message: Message, chatRequestOptions?: { data?: any }) => Promise<string | null | undefined>
}
