import { describe, it, expect, vi, beforeEach } from "vitest"
import { webviewMessageHandler } from "../webviewMessageHandler"
import * as processFiles from "../../../integrations/misc/process-files"
import { FileReference, FileAttachment } from "../../../shared/FileTypes"

// Mock the process-files module
vi.mock("../../../integrations/misc/process-files", () => ({
	selectFiles: vi.fn(),
	convertImageReferencesToDataUrls: vi.fn(),
}))

describe("webviewMessageHandler - selectFiles", () => {
	let mockProvider: any

	beforeEach(() => {
		mockProvider = {
			postMessageToWebview: vi.fn(),
		}
		vi.clearAllMocks()
	})

	it("should convert FileReference[] to string[] for images when handling selectFiles", async () => {
		// Mock data
		const mockFileReferences: FileReference[] = [
			{
				path: "image1.png",
				uri: "file:///path/to/image1.png",
				size: 1024,
				mimeType: "image/png",
			},
			{
				path: "image2.jpg",
				uri: "file:///path/to/image2.jpg",
				size: 2048,
				mimeType: "image/jpeg",
			},
		]

		const mockFileAttachments: FileAttachment[] = [
			{
				path: "file1.txt",
				content: "Hello world",
				type: "txt",
			},
		]

		const mockDataUrls = [
			"data:image/png;base64,iVBORw0KGgoAAAANS...",
			"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
		]

		// Setup mocks
		vi.mocked(processFiles.selectFiles).mockResolvedValue({
			images: mockFileReferences,
			files: mockFileAttachments,
		})
		vi.mocked(processFiles.convertImageReferencesToDataUrls).mockResolvedValue(mockDataUrls)

		// Execute
		await webviewMessageHandler(mockProvider, { type: "selectFiles" })

		// Verify
		expect(processFiles.selectFiles).toHaveBeenCalledOnce()
		expect(processFiles.convertImageReferencesToDataUrls).toHaveBeenCalledWith(mockFileReferences)
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "selectedFiles",
			images: mockDataUrls,
			files: mockFileAttachments,
		})
	})

	it("should handle empty file selection", async () => {
		// Setup mocks for empty selection
		vi.mocked(processFiles.selectFiles).mockResolvedValue({
			images: [],
			files: [],
		})
		vi.mocked(processFiles.convertImageReferencesToDataUrls).mockResolvedValue([])

		// Execute
		await webviewMessageHandler(mockProvider, { type: "selectFiles" })

		// Verify
		expect(processFiles.selectFiles).toHaveBeenCalledOnce()
		expect(processFiles.convertImageReferencesToDataUrls).toHaveBeenCalledWith([])
		expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
			type: "selectedFiles",
			images: [],
			files: [],
		})
	})
})
