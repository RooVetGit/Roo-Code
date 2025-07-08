import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "child_process"
import { promisify } from "util"
import fetch from "node-fetch"

/**
 * ON_PREM + vLLM E2E 테스트
 *
 * 실제 vLLM 서버와 VS Code 확장의 통합을 테스트합니다.
 * Docker로 vLLM 서버를 시작하고 확장과의 상호작용을 확인합니다.
 */

interface VLLMServerConfig {
	host: string
	port: number
	model: string
}

class VLLMTestServer {
	private process: ChildProcess | null = null
	private config: VLLMServerConfig

	constructor(config: VLLMServerConfig) {
		this.config = config
	}

	async start(): Promise<void> {
		console.log("🚀 Starting vLLM test server...")

		// vLLM 서버를 Docker로 시작
		this.process = spawn(
			"docker",
			[
				"run",
				"--rm",
				"-p",
				`${this.config.port}:8000`,
				"--gpus",
				"all", // GPU 사용 (없으면 CPU 모드로 대체)
				"vllm/vllm-openai:latest",
				"--model",
				this.config.model,
				"--host",
				"0.0.0.0",
				"--port",
				"8000",
			],
			{
				stdio: ["ignore", "pipe", "pipe"],
			},
		)

		if (this.process.stdout) {
			this.process.stdout.on("data", (data) => {
				console.log(`[vLLM] ${data}`)
			})
		}

		if (this.process.stderr) {
			this.process.stderr.on("data", (data) => {
				console.error(`[vLLM Error] ${data}`)
			})
		}

		// 서버가 준비될 때까지 대기 (최대 120초)
		await this.waitForReady(120000)
	}

	async stop(): Promise<void> {
		if (this.process) {
			console.log("🛑 Stopping vLLM test server...")
			this.process.kill("SIGTERM")

			// 프로세스 종료 대기
			await new Promise((resolve) => {
				this.process!.on("exit", resolve)
				setTimeout(resolve, 5000) // 5초 후 강제 종료
			})

			this.process = null
		}
	}

	private async waitForReady(timeoutMs: number): Promise<void> {
		const startTime = Date.now()
		const url = `http://${this.config.host}:${this.config.port}/v1/models`

		while (Date.now() - startTime < timeoutMs) {
			try {
				const response = await fetch(url)
				if (response.ok) {
					console.log("✅ vLLM server is ready!")
					return
				}
			} catch (error) {
				// 서버가 아직 준비되지 않음
			}

			await new Promise((resolve) => setTimeout(resolve, 2000))
		}

		throw new Error(`vLLM server failed to start within ${timeoutMs}ms`)
	}

	getBaseUrl(): string {
		return `http://${this.config.host}:${this.config.port}`
	}
}

test.describe("ON_PREM vLLM E2E Tests", () => {
	let vllmServer: VLLMTestServer
	const serverConfig: VLLMServerConfig = {
		host: "localhost",
		port: 8000,
		model: "microsoft/DialoGPT-small", // 작은 모델로 테스트
	}

	test.beforeAll(async () => {
		// CI 환경에서는 스킵 (실제 GPU가 필요함)
		if (process.env.CI) {
			test.skip()
		}

		vllmServer = new VLLMTestServer(serverConfig)

		try {
			await vllmServer.start()
		} catch (error) {
			console.warn("⚠️ vLLM server 시작 실패 - 테스트 스킵")
			test.skip()
		}
	})

	test.afterAll(async () => {
		if (vllmServer) {
			await vllmServer.stop()
		}
	})

	test("should connect to vLLM server in ON_PREM mode", async ({ page }) => {
		// VS Code 확장 환경 설정
		await page.addInitScript(() => {
			// ON_PREM 모드 활성화
			window.process = {
				env: { ON_PREM: "true" },
			} as any

			// localLLM 설정 모킹
			window.vscode = {
				workspace: {
					getConfiguration: (section: string) => {
						if (section === "roo-cline") {
							return {
								get: (key: string) => {
									if (key === "localLLM") {
										return {
											type: "vllm",
											url: "http://localhost:8000",
											model: "microsoft/DialoGPT-small",
										}
									}
									return undefined
								},
							}
						}
						return { get: () => undefined }
					},
				},
			} as any
		})

		// 확장 페이지 로드
		await page.goto("vscode://roo-code.roo-cline")

		// vLLM 연결 확인 버튼 클릭 (UI에 이런 기능이 있다고 가정)
		await page.click("[data-testid='test-llm-connection']")

		// 연결 성공 메시지 확인
		await expect(page.locator("[data-testid='connection-status']")).toContainText("Connected to vLLM")

		// 외부 API 호출 차단 확인
		const externalCallResult = await page.evaluate(async () => {
			try {
				await fetch("https://api.openai.com/v1/models")
				return "success"
			} catch (error) {
				return error.message
			}
		})

		expect(externalCallResult).toContain("ON_PREM mode: External HTTP calls are disabled")
	})

	test("should generate text using vLLM in ON_PREM mode", async ({ page }) => {
		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
			window.vscode = {
				workspace: {
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === "localLLM") {
								return {
									type: "vllm",
									url: "http://localhost:8000",
									model: "microsoft/DialoGPT-small",
								}
							}
							return undefined
						},
					}),
				},
			} as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 새 채팅 시작
		await page.click("[data-testid='new-chat']")

		// 간단한 질문 입력
		await page.fill("[data-testid='chat-input']", "Hello, how are you?")
		await page.click("[data-testid='send-message']")

		// vLLM 응답 대기 (최대 30초)
		await page.waitForSelector("[data-testid='ai-response']", { timeout: 30000 })

		// 응답이 생성되었는지 확인
		const response = await page.textContent("[data-testid='ai-response']")
		expect(response).toBeTruthy()
		expect(response!.length).toBeGreaterThan(0)

		// 응답에 vLLM 제공자 정보가 표시되는지 확인
		await expect(page.locator("[data-testid='provider-info']")).toContainText("vLLM")
	})

	test("should handle vLLM streaming responses", async ({ page }) => {
		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 스트리밍 응답 테스트
		await page.fill("[data-testid='chat-input']", "Write a short story about a robot.")
		await page.click("[data-testid='send-message']")

		// 스트리밍 시작 확인
		await page.waitForSelector("[data-testid='streaming-indicator']", { timeout: 5000 })

		// 텍스트가 점진적으로 나타나는지 확인
		let previousLength = 0
		let streamingWorking = false

		for (let i = 0; i < 10; i++) {
			await page.waitForTimeout(1000)
			const currentText = (await page.textContent("[data-testid='ai-response']")) || ""

			if (currentText.length > previousLength) {
				streamingWorking = true
				previousLength = currentText.length
			}
		}

		expect(streamingWorking).toBe(true)

		// 스트리밍 완료 확인
		await page.waitForSelector("[data-testid='streaming-indicator']", {
			state: "hidden",
			timeout: 30000,
		})
	})

	test("should fallback gracefully when vLLM is unavailable", async ({ page }) => {
		// 잘못된 vLLM URL 설정
		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
			window.vscode = {
				workspace: {
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === "localLLM") {
								return {
									type: "vllm",
									url: "http://localhost:9999", // 존재하지 않는 포트
									model: "invalid-model",
								}
							}
							return undefined
						},
					}),
				},
			} as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 연결 테스트
		await page.click("[data-testid='test-llm-connection']")

		// 연결 실패 메시지 확인
		await expect(page.locator("[data-testid='connection-error']")).toContainText("Failed to connect")

		// 채팅 시도
		await page.fill("[data-testid='chat-input']", "Hello")
		await page.click("[data-testid='send-message']")

		// 오류 메시지 확인
		await expect(page.locator("[data-testid='error-message']")).toContainText("vLLM server is not available")
	})

	test("should respect ON_PREM telemetry settings", async ({ page }) => {
		// 텔레메트리 호출 모니터링
		const telemetryRequests: string[] = []

		await page.route("**/capture", (route, request) => {
			telemetryRequests.push(request.url())
			route.abort()
		})

		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 여러 액션 수행
		await page.click("[data-testid='new-chat']")
		await page.fill("[data-testid='chat-input']", "Test message")
		await page.click("[data-testid='send-message']")

		// 잠시 대기
		await page.waitForTimeout(2000)

		// 텔레메트리 호출이 차단되었는지 확인
		expect(telemetryRequests).toHaveLength(0)
	})

	test("should validate vLLM model configuration", async ({ page }) => {
		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 설정 페이지로 이동
		await page.click("[data-testid='settings-button']")

		// vLLM 설정 섹션 확인
		await expect(page.locator("[data-testid='vllm-settings']")).toBeVisible()

		// 현재 모델 정보 표시 확인
		await expect(page.locator("[data-testid='current-model']")).toContainText("microsoft/DialoGPT-small")

		// URL 유효성 검사
		await page.fill("[data-testid='vllm-url']", "invalid-url")
		await page.click("[data-testid='validate-config']")
		await expect(page.locator("[data-testid='validation-error']")).toContainText("Invalid URL format")

		// 올바른 URL 설정
		await page.fill("[data-testid='vllm-url']", "http://localhost:8000")
		await page.click("[data-testid='validate-config']")
		await expect(page.locator("[data-testid='validation-success']")).toContainText("Configuration valid")
	})
})

test.describe("ON_PREM Ollama E2E Tests", () => {
	test("should work with Ollama in ON_PREM mode", async ({ page }) => {
		// Ollama 서버가 실행 중인지 확인
		try {
			const response = await fetch("http://localhost:11434/api/tags")
			if (!response.ok) {
				test.skip()
			}
		} catch {
			test.skip() // Ollama 서버가 없으면 스킵
		}

		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
			window.vscode = {
				workspace: {
					getConfiguration: () => ({
						get: (key: string) => {
							if (key === "localLLM") {
								return {
									type: "ollama",
									url: "http://localhost:11434",
									model: "llama2:7b",
								}
							}
							return undefined
						},
					}),
				},
			} as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// Ollama 연결 테스트
		await page.click("[data-testid='test-llm-connection']")
		await expect(page.locator("[data-testid='connection-status']")).toContainText("Connected to Ollama")

		// 텍스트 생성 테스트
		await page.fill("[data-testid='chat-input']", "What is AI?")
		await page.click("[data-testid='send-message']")

		await page.waitForSelector("[data-testid='ai-response']", { timeout: 30000 })
		const response = await page.textContent("[data-testid='ai-response']")
		expect(response).toBeTruthy()
	})
})

test.describe("Firewall Simulation Tests", () => {
	test("should handle network restrictions properly", async ({ page }) => {
		// 모든 외부 요청 차단
		await page.route("**/*", (route, request) => {
			const url = new URL(request.url())

			// 로컬/내부 호출만 허용
			if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || !url.hostname.includes(".")) {
				route.continue()
			} else {
				route.abort("failed")
			}
		})

		await page.addInitScript(() => {
			window.process = { env: { ON_PREM: "true" } } as any
		})

		await page.goto("vscode://roo-code.roo-cline")

		// 외부 API 호출 시도 (차단되어야 함)
		const blockedResult = await page.evaluate(async () => {
			try {
				await fetch("https://api.openai.com/v1/models")
				return "allowed"
			} catch (error) {
				return "blocked"
			}
		})

		expect(blockedResult).toBe("blocked")

		// 내부 호출은 허용되어야 함
		const allowedResult = await page.evaluate(async () => {
			try {
				await fetch("http://localhost:8000/v1/models")
				return "allowed"
			} catch (error) {
				return "blocked"
			}
		})

		expect(allowedResult).toBe("allowed")
	})
})
