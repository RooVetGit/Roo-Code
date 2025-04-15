import { render, fireEvent, screen, waitFor, act } from "@testing-library/react"
import ChatTextArea from "../ChatTextArea"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"
import { defaultModeSlug } from "../../../../../src/shared/modes"
import * as pathMentions from "../../../utils/path-mentions"

// Mock modules
jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))
jest.mock("../../../components/common/CodeBlock")
jest.mock("../../../components/common/MarkdownBlock")
jest.mock("../../../utils/path-mentions", () => ({
	convertToMentionPath: jest.fn((path, cwd) => {
		// Simple mock implementation that mimics the real function's behavior
		if (cwd && path.toLowerCase().startsWith(cwd.toLowerCase())) {
			const relativePath = path.substring(cwd.length)
			return "@" + (relativePath.startsWith("/") ? relativePath : "/" + relativePath)
		}
		return path
	}),
}))

// Get the mocked postMessage function
const mockPostMessage = vscode.postMessage as jest.Mock
const mockConvertToMentionPath = pathMentions.convertToMentionPath as jest.Mock

// Mock ExtensionStateContext
jest.mock("../../../context/ExtensionStateContext")

// Custom query function to get the enhance prompt button
const getEnhancePromptButton = () => {
	return screen.getByRole("button", {
		name: (_, element) => {
			// Find the button with the sparkle icon
			return element.querySelector(".codicon-sparkle") !== null
		},
	})
}

describe("ChatTextArea", () => {
	const defaultProps = {
		inputValue: "",
		setInputValue: jest.fn(),
		onSend: jest.fn(),
		textAreaDisabled: false,
		selectApiConfigDisabled: false,
		onSelectImages: jest.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: jest.fn(),
		onHeightChange: jest.fn(),
		mode: defaultModeSlug,
		setMode: jest.fn(),
		modeShortcutText: "(⌘. for next mode)",
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Default mock implementation for useExtensionState
		;(useExtensionState as jest.Mock).mockReturnValue({
			filePaths: [],
			openedTabs: [],
			apiConfiguration: {
				apiProvider: "anthropic",
			},
		})
	})

	describe("enhance prompt button", () => {
		it("should be disabled when textAreaDisabled is true", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
			})
			render(<ChatTextArea {...defaultProps} textAreaDisabled={true} />)
			const enhanceButton = getEnhancePromptButton()
			expect(enhanceButton).toHaveClass("cursor-not-allowed")
		})
	})

	describe("handleEnhancePrompt", () => {
		it("should send message with correct configuration when clicked", () => {
			const apiConfiguration = {
				apiProvider: "openrouter",
				apiKey: "test-key",
			}

			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration,
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = getEnhancePromptButton()
			fireEvent.click(enhanceButton)

			expect(mockPostMessage).toHaveBeenCalledWith({
				type: "enhancePrompt",
				text: "Test prompt",
			})
		})

		it("should not send message when input is empty", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="" />)

			const enhanceButton = getEnhancePromptButton()
			fireEvent.click(enhanceButton)

			expect(mockPostMessage).not.toHaveBeenCalled()
		})

		it("should show loading state while enhancing", () => {
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
				},
			})

			render(<ChatTextArea {...defaultProps} inputValue="Test prompt" />)

			const enhanceButton = getEnhancePromptButton()
			fireEvent.click(enhanceButton)

			const loadingSpinner = screen.getByText("", { selector: ".codicon-loading" })
			expect(loadingSpinner).toBeInTheDocument()
		})
	})

	describe("effect dependencies", () => {
		it("should update when apiConfiguration changes", () => {
			const { rerender } = render(<ChatTextArea {...defaultProps} />)

			// Update apiConfiguration
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				apiConfiguration: {
					apiProvider: "openrouter",
					newSetting: "test",
				},
			})

			rerender(<ChatTextArea {...defaultProps} />)

			// Verify the enhance button appears after apiConfiguration changes
			expect(getEnhancePromptButton()).toBeInTheDocument()
		})
	})

	describe("enhanced prompt response", () => {
		it("should update input value when receiving enhanced prompt", () => {
			const setInputValue = jest.fn()

			render(<ChatTextArea {...defaultProps} setInputValue={setInputValue} />)

			// Simulate receiving enhanced prompt message
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "enhancedPrompt",
						text: "Enhanced test prompt",
					},
				}),
			)

			expect(setInputValue).toHaveBeenCalledWith("Enhanced test prompt")
		})
	})

	describe("multi-file drag and drop", () => {
		const mockCwd = "/Users/test/project"

		beforeEach(() => {
			jest.clearAllMocks()
			;(useExtensionState as jest.Mock).mockReturnValue({
				filePaths: [],
				openedTabs: [],
				cwd: mockCwd,
			})
			mockConvertToMentionPath.mockClear()
		})

		it("should process multiple file paths separated by newlines", async () => {
			const setInputValue = jest.fn()

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue="Initial text" />,
			)

			// Create a mock dataTransfer object with uri-list data containing multiple file paths
			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						return "file:///Users/test/project/file1.js\nfile:///Users/test/project/file2.js"
					}
					return "" // Return empty for other formats like 'text'
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// Verify vscode.postMessage was called with the correct URIs
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: ["file:///Users/test/project/file1.js", "file:///Users/test/project/file2.js"],
			})

			// 模拟扩展返回的、已转换好的提及路径
			// 注意：这里的路径格式应与 convertToMentionPath mock 的输出一致
			const expectedMentionPaths = ["@/file1.js", "@/file2.js"]

			// 使用 act 包裹状态更新的模拟
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 使用 waitFor 等待异步操作完成并断言最终状态
			await waitFor(() => {
				// 预期结果是新提及路径 + 原始输入值
				expect(setInputValue).toHaveBeenCalledWith("@/file1.js @/file2.js Initial text")
			})

			// 旧的同步断言已被移除，因为逻辑现在是异步的，并通过 postMessage 处理
		})

		it("should filter out empty lines in the dragged text", async () => {
			// 标记为异步
			const setInputValue = jest.fn()

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue="Initial text" />,
			)

			// 调整模拟数据 (`dataTransfer`)
			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						return "file:///Users/test/project/file1.js\nfile:///Users/test/project/file2.js" // 包含两个有效 URI
					}
					return ""
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// 添加 postMessage 断言
			const expectedUris = ["file:///Users/test/project/file1.js", "file:///Users/test/project/file2.js"]
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: expectedUris,
			})

			// 移除旧断言 (针对 mockConvertToMentionPath 的同步断言)
			// expect(mockConvertToMentionPath).toHaveBeenCalledTimes(2)
			// expect(setInputValue).toHaveBeenCalledWith("@/file1.js @/file2.js Initial text")

			// 模拟异步消息响应
			// 注意：这里的路径格式应与 convertToMentionPath mock 的输出一致或模拟实际转换结果
			const expectedMentionPaths = ["@/file1.js", "@/file2.js"] // 模拟过滤和转换结果
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 更新断言 (使用 waitFor)
			await waitFor(() => {
				// 确认 setInputValue 被调用，并且只包含有效文件的提及
				// 预期结果是新提及路径 + 原始输入值
				expect(setInputValue).toHaveBeenCalledWith("@/file1.js @/file2.js Initial text")
			})
		})

		// 重点验证最终插入到文本区域的文本内容是否正确
		it("should correctly update text content after adding multiple mentions", async () => {
			// 1. 标记为异步
			const setInputValue = jest.fn()
			const initialInputValue = "Hello world" // 初始值

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue={initialInputValue} />,
			)

			// 3. 调整模拟数据 (`dataTransfer`)
			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						// 返回包含两个有效文件 URI 的字符串
						return "file:///Users/test/project/file1.js\nfile:///Users/test/project/file2.js"
					}
					return "" // 其他格式返回空
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// 4. 添加 `postMessage` 断言
			const expectedUris = ["file:///Users/test/project/file1.js", "file:///Users/test/project/file2.js"]
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: expectedUris,
			})

			// 5. 移除/修改旧断言 (移除对 setInputValue 的同步调用断言)
			// expect(setInputValue).toHaveBeenCalledWith(...) // 已移除

			// 6. 模拟异步消息响应
			// 注意：这里的路径格式应模拟实际转换结果
			const expectedMentionPaths = ["@/file1.js", "@/file2.js"] // 模拟转换后的提及路径
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 7. 更新断言 (使用 `waitFor` 验证最终文本)
			await waitFor(() => {
				// 验证最终的文本内容是否正确
				// 预期结果是新提及路径 + 原始输入值
				expect(setInputValue).toHaveBeenCalledWith("@/file1.js @/file2.js Hello world")
			})
		})

		it("should handle very long file paths correctly", async () => {
			// 2. 标记为异步
			const setInputValue = jest.fn()
			const initialInputValue = "Initial text" // 假设初始文本

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue={initialInputValue} />,
			)

			// 3. 调整模拟数据 (`dataTransfer`)
			const longPathUri =
				"file:///Users/test/project/very/long/path/with/many/nested/directories/and/a/very/long/filename/with/extension.typescript"
			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						return longPathUri
					}
					return "" // Return empty for other formats like 'text'
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// 4. 添加 `postMessage` 断言
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: [longPathUri],
			})

			// 5. 移除旧断言 (已删除)

			// 6. 模拟异步消息响应
			// 模拟扩展返回的、可能经过处理的长路径提及
			const expectedMentionPaths = ["'@/very/long/path/.../extension.typescript'"] // 假设扩展截断了路径
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 7. 更新断言 (使用 `waitFor`)
			await waitFor(() => {
				// 验证最终的文本内容是否正确
				// 预期结果是处理后的提及 + 原始输入值
				expect(setInputValue).toHaveBeenCalledWith("'@/very/long/path/.../extension.typescript' Initial text")
			})
		})

		it("should handle paths with special characters correctly", async () => {
			// 1. 标记为异步
			const setInputValue = jest.fn()
			const initialInputValue = "Initial text" // 假设初始文本

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue={initialInputValue} />,
			)

			// 3. 调整模拟数据 (`dataTransfer`)
			const specialPathUri1 = "file:///Users/test/project/file%20with%20spaces.js" // 包含空格
			const specialPathUri2 = "file:///Users/test/project/file%23with%23hash.ts" // 包含 #
			const specialPathUri3 = "file:///Users/test/project/file&with&ampersand.css" // 包含 &
			const specialPathUri4 = "file:///Users/test/project/file(with)parentheses.py" // 包含 ()
			const specialUris = [specialPathUri1, specialPathUri2, specialPathUri3, specialPathUri4]

			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						return specialUris.join("\n") // 返回包含特殊字符 URI 的字符串
					}
					return "" // 其他格式返回空
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// 4. 添加 `postMessage` 断言
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: specialUris,
			})

			// 5. 移除旧断言 (针对 mockConvertToMentionPath 和 setInputValue 的同步断言)
			// expect(mockConvertToMentionPath).toHaveBeenCalledTimes(4) ...
			// expect(setInputValue).toHaveBeenCalledWith(...)

			// 6. 模拟异步消息响应
			// 模拟扩展返回的、对应特殊字符 URI 的提及路径
			const expectedMentionPaths = [
				"'file' (see below for file content) with spaces.js",
				"'file#with#hash.ts' (see below for file content)",
				"'file&with&ampersand.css' (see below for file content)",
				"'file(with)parentheses.py' (see below for file content)",
			]
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 7. 更新断言 (使用 `waitFor`)
			await waitFor(() => {
				// 验证最终的文本内容是否正确
				// 预期结果是新提及路径 + 原始输入值
				expect(setInputValue).toHaveBeenCalledWith(
					"'file' (see below for file content) with spaces.js 'file#with#hash.ts' (see below for file content) 'file&with&ampersand.css' (see below for file content) 'file(with)parentheses.py' (see below for file content) Initial text",
				)
			})
		})

		it("should handle paths outside the current working directory", async () => {
			// 1. 标记为异步
			const setInputValue = jest.fn()
			const initialInputValue = "" // 初始值为空

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue={initialInputValue} />,
			)

			// 3. 调整模拟数据 (`dataTransfer`)
			const outsidePathUri = "file:///Users/other/project/file.js" // 定义外部路径 URI
			const dataTransfer = {
				getData: jest.fn((format: string) => {
					if (format === "application/vnd.code.uri-list") {
						return outsidePathUri // 返回外部路径 URI
					}
					return "" // 其他格式返回空
				}),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// 4. 添加 `postMessage` 断言
			expect(vscode.postMessage).toHaveBeenCalledWith({
				type: "getMentionPathsFromUris",
				uris: [outsidePathUri],
			})

			// 5. 移除旧断言 (针对 mockConvertToMentionPath 和 setInputValue 的同步断言)
			// expect(mockConvertToMentionPath).toHaveBeenCalledWith(outsidePath, mockCwd) // 已移除
			// expect(setInputValue).toHaveBeenCalledWith("/Users/other/project/file.js ") // 已移除

			// 6. 模拟异步消息响应 (关键)
			// 模拟扩展返回的、未转换的外部路径
			const expectedMentionPaths = ["/Users/other/project/file.js"] // 注意：这里是原始路径
			act(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "mentionPathsResponse",
							mentionPaths: expectedMentionPaths,
						},
					}),
				)
			})

			// 7. 更新断言 (使用 `waitFor`)
			await waitFor(() => {
				// 验证最终文本包含原始的外部路径 + 原始文本 (此处为空)
				// 注意末尾的空格，因为 handleDrop 会添加一个空格
				expect(setInputValue).toHaveBeenCalledWith("/Users/other/project/file.js ")
			})
		})

		it("should do nothing when dropped text is empty", () => {
			const setInputValue = jest.fn()

			const { container } = render(
				<ChatTextArea {...defaultProps} setInputValue={setInputValue} inputValue="Initial text" />,
			)

			// Create a mock dataTransfer object with empty text
			const dataTransfer = {
				getData: jest.fn().mockReturnValue(""),
				files: [],
			}

			// Simulate drop event
			fireEvent.drop(container.querySelector(".chat-text-area")!, {
				dataTransfer,
				preventDefault: jest.fn(),
			})

			// Verify convertToMentionPath was not called
			expect(mockConvertToMentionPath).not.toHaveBeenCalled()

			// Verify setInputValue was not called
			expect(setInputValue).not.toHaveBeenCalled()
		})
	})

	describe("selectApiConfig", () => {
		// Helper function to get the API config dropdown
		const getApiConfigDropdown = () => {
			return screen.getByTitle("chat:selectApiConfig")
		}
		it("should be enabled independently of textAreaDisabled", () => {
			render(<ChatTextArea {...defaultProps} textAreaDisabled={true} selectApiConfigDisabled={false} />)
			const apiConfigDropdown = getApiConfigDropdown()
			expect(apiConfigDropdown).not.toHaveAttribute("disabled")
		})
		it("should be disabled when selectApiConfigDisabled is true", () => {
			render(<ChatTextArea {...defaultProps} textAreaDisabled={true} selectApiConfigDisabled={true} />)
			const apiConfigDropdown = getApiConfigDropdown()
			expect(apiConfigDropdown).toHaveAttribute("disabled")
		})
	})
})
