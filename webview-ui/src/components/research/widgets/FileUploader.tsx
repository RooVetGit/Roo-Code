import { Loader2, Paperclip } from "lucide-react"
import { ChangeEvent, useState } from "react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface FileUploaderProps {
	config?: {
		inputId?: string
		fileSizeLimit?: number
		allowedExtensions?: string[]
		checkExtension?: (extension: string) => string | null
		disabled: boolean
		multiple?: boolean
	}
	onFileUpload: (file: File) => Promise<void>
	onFileError?: (errMsg: string) => void
}

const DEFAULT_INPUT_ID = "fileInput"
const DEFAULT_FILE_SIZE_LIMIT = 1024 * 1024 * 50 // 50 MB

export function FileUploader({ config, onFileUpload, onFileError }: FileUploaderProps) {
	const [uploading, setUploading] = useState(false)
	const [remainingFiles, setRemainingFiles] = useState<number>(0)

	const inputId = config?.inputId || DEFAULT_INPUT_ID
	const fileSizeLimit = config?.fileSizeLimit || DEFAULT_FILE_SIZE_LIMIT
	const allowedExtensions = config?.allowedExtensions
	const defaultCheckExtension = (extension: string) => {
		if (allowedExtensions && !allowedExtensions.includes(extension)) {
			return `Invalid file type. Please select a file with one of these formats: ${allowedExtensions.join(",")}`
		}
		return null
	}
	const checkExtension = config?.checkExtension ?? defaultCheckExtension

	const isFileSizeExceeded = (file: File) => {
		return file.size > fileSizeLimit
	}

	const resetInput = () => {
		const fileInput = document.getElementById(inputId) as HTMLInputElement
		fileInput.value = ""
	}

	const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || [])
		if (!files.length) return

		setUploading(true)

		await handleUpload(files)

		resetInput()
		setUploading(false)
	}

	const handleUpload = async (files: File[]) => {
		const onFileUploadError = onFileError || window.alert
		// Validate files
		// If multiple files with image or multiple images
		if (files.length > 1 && files.some((file) => file.type.startsWith("image/"))) {
			onFileUploadError("Multiple files with image are not supported")
			return
		}

		for (const file of files) {
			const fileExtension = file.name.split(".").pop() || ""
			const extensionFileError = checkExtension(fileExtension)
			if (extensionFileError) {
				onFileUploadError(extensionFileError)
				return
			}

			if (isFileSizeExceeded(file)) {
				onFileUploadError(`File size exceeded. Limit is ${fileSizeLimit / 1024 / 1024} MB`)
				return
			}
		}

		setRemainingFiles(files.length)
		for (const file of files) {
			await onFileUpload(file)
			setRemainingFiles((prev) => prev - 1)
		}
		setRemainingFiles(0)
	}

	return (
		<div className="self-stretch">
			<input
				type="file"
				id={inputId}
				style={{ display: "none" }}
				onChange={onFileChange}
				accept={allowedExtensions?.join(",")}
				disabled={config?.disabled || uploading}
				multiple={config?.multiple}
			/>
			<label
				htmlFor={inputId}
				className={cn(
					buttonVariants({ variant: "secondary", size: "icon" }),
					"relative cursor-pointer",
					uploading && "opacity-50",
				)}>
				{uploading ? (
					<div className="relative flex h-full w-full items-center justify-center">
						<Loader2 className="absolute h-6 w-6 animate-spin" />
						{remainingFiles > 0 && (
							<span className="absolute inset-0 flex items-center justify-center text-xs">
								{remainingFiles}
							</span>
						)}
					</div>
				) : (
					<Paperclip className="h-4 w-4 -rotate-45" />
				)}
			</label>
		</div>
	)
}
