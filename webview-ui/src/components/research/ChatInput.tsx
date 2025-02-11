import { Button, AutosizeTextarea } from "@/components/ui"

import { Message } from "./types"
import { FileUploader } from "./widgets/FileUploader"
import { ChatInputProvider } from "./providers/ChatInputProvider"
import { useChatUI } from "./hooks/useChatUI"
import { useChatInput } from "./hooks/useChatInput"

/**
 * ChatInput
 */

type ChatInputProps = {
	resetUploadedFiles?: () => void
	annotations?: any
}

function ChatInput({ annotations, resetUploadedFiles }: ChatInputProps) {
	const { input, setInput, append, isLoading, requestData } = useChatUI()
	const isDisabled = isLoading || !input.trim()

	const submit = async () => {
		const newMessage: Omit<Message, "id"> = {
			role: "user",
			content: input,
			annotations,
		}

		setInput("") // Clear the input.
		resetUploadedFiles?.() // Reset the uploaded files.

		await append(newMessage, { data: requestData })
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		await submit()
	}

	const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (isDisabled) {
			return
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			await submit()
		}
	}

	return (
		<ChatInputProvider value={{ isDisabled, handleKeyDown, handleSubmit }}>
			<div className="flex shrink-0 flex-col gap-4 p-4">
				<ChatInputForm />
			</div>
		</ChatInputProvider>
	)
}

/**
 * ChatInputForm
 */

function ChatInputForm() {
	const { handleSubmit } = useChatInput()

	return (
		<form onSubmit={handleSubmit} className="relative">
			<ChatInputField />
			<ChatInputSubmit />
		</form>
	)
}

/**
 * ChatInputField
 */

interface ChatInputFieldProps {
	placeholder?: string
}

function ChatInputField({ placeholder = "Type a message" }: ChatInputFieldProps) {
	const { input, setInput } = useChatUI()
	const { handleKeyDown } = useChatInput()

	return (
		<AutosizeTextarea
			name="input"
			placeholder={placeholder}
			// className="h-[40px] min-h-0 flex-1"
			value={input}
			onChange={({ target: { value } }) => setInput(value)}
			onKeyDown={handleKeyDown}
		/>
	)
}

/**
 * ChatInput
 */

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "csv", "pdf", "txt", "docx"]

interface ChatInputUploadProps {
	onUpload?: (file: File) => Promise<void> | undefined
	allowedExtensions?: string[]
	multiple?: boolean
}

function ChatInputUpload({ onUpload, allowedExtensions = ALLOWED_EXTENSIONS, multiple = true }: ChatInputUploadProps) {
	const { requestData, setRequestData, isLoading } = useChatUI()

	const onFileUpload = async (file: File) => {
		if (onUpload) {
			await onUpload(file)
		} else {
			setRequestData({ ...(requestData || {}), file })
		}
	}

	return <FileUploader onFileUpload={onFileUpload} config={{ disabled: isLoading, allowedExtensions, multiple }} />
}

/**
 * ChatInputSubmit
 */

function ChatInputSubmit() {
	const { isDisabled } = useChatInput()

	return (
		<Button variant="ghost" type="submit" disabled={isDisabled}>
			<span className="codicon codicon-send" />
		</Button>
	)
}

ChatInput.Form = ChatInputForm
ChatInput.Field = ChatInputField
ChatInput.Upload = ChatInputUpload
ChatInput.Submit = ChatInputSubmit

export default ChatInput
