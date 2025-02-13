import { PaperPlaneIcon, StopIcon } from "@radix-ui/react-icons"

import { Button, AutosizeTextarea } from "@/components/ui"

import { Message } from "./types"
// import { FileUploader } from "./widgets/FileUploader"
import { ChatInputProvider } from "./ChatInputProvider"
import { useChatUI } from "./useChatUI"
import { useChatInput } from "./useChatInput"
import { useChatMessages } from "./useChatMessages"

/**
 * ChatInput
 */

type ChatInputProps = {
	resetUploadedFiles?: () => void
	annotations?: any
}

export function ChatInput({ annotations, resetUploadedFiles }: ChatInputProps) {
	const { input, setInput, append, isLoading, requestData } = useChatUI()
	const isDisabled = isLoading || !input.trim()

	const submit = async () => {
		if (input.trim() === "") {
			return
		}

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
			<div className="border-t border-vscode-editor-background p-3">
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

function ChatInputField({ placeholder = "Chat" }: ChatInputFieldProps) {
	const { input, setInput } = useChatUI()
	const { handleKeyDown } = useChatInput()

	return (
		<AutosizeTextarea
			name="input"
			placeholder={placeholder}
			minHeight={75}
			maxHeight={200}
			value={input}
			onChange={({ target: { value } }) => setInput(value)}
			onKeyDown={handleKeyDown}
			className="resize-none px-3 pt-3 pb-[50px]"
		/>
	)
}

/**
 * ChatInputUpload
 */

// const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "csv", "pdf", "txt", "docx"]

// interface ChatInputUploadProps {
// 	onUpload?: (file: File) => Promise<void> | undefined
// 	allowedExtensions?: string[]
// 	multiple?: boolean
// }

// function ChatInputUpload({ onUpload, allowedExtensions = ALLOWED_EXTENSIONS, multiple = true }: ChatInputUploadProps) {
// 	const { requestData, setRequestData, isLoading } = useChatUI()

// 	const onFileUpload = async (file: File) => {
// 		if (onUpload) {
// 			await onUpload(file)
// 		} else {
// 			setRequestData({ ...(requestData || {}), file })
// 		}
// 	}

// 	return <FileUploader onFileUpload={onFileUpload} config={{ disabled: isLoading, allowedExtensions, multiple }} />
// }

/**
 * ChatInputSubmit
 */

function ChatInputSubmit() {
	const { stop } = useChatUI()
	const { showStop } = useChatMessages()
	const { isDisabled } = useChatInput()

	return (
		<div className="absolute bottom-[1px] left-[1px] right-[1px] h-[40px] bg-input border-t border-vscode-editor-background rounded-b-md p-1">
			<div className="flex flex-row-reverse items-center gap-2">
				{showStop ? (
					<Button type="button" variant="ghost" size="sm" onClick={stop}>
						<StopIcon className="text-destructive" />
					</Button>
				) : (
					<Button type="submit" variant="ghost" size="icon" disabled={isDisabled}>
						<PaperPlaneIcon />
					</Button>
				)}
			</div>
		</div>
	)
}
