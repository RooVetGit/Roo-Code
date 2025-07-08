#!/usr/bin/env tsx

/**
 * 파이어월 테스트 스크립트
 *
 * Docker Compose 환경에서 ON_PREM 모드의 네트워크 제한을 테스트합니다.
 * - 내부 vLLM/Ollama 서버 접근 허용 확인
 * - 외부 API 호출 차단 확인
 * - 텔레메트리 차단 확인
 */

import fetch from "node-fetch"
import { createFetchWrapper } from "../../src/utils/fetch-wrapper"
import { OnPremTelemetryClient } from "../../packages/telemetry/src/OnPremTelemetryClient"
import { TelemetryEventName } from "@roo-code/types"

interface TestResult {
	name: string
	passed: boolean
	error?: string
	duration: number
}

class FirewallTester {
	private results: TestResult[] = []
	private vllmUrl: string
	private ollamaUrl: string

	constructor() {
		this.vllmUrl = process.env.VLLM_URL || "http://vllm-server:8000"
		this.ollamaUrl = process.env.OLLAMA_URL || "http://ollama-server:11434"
	}

	async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
		const startTime = Date.now()

		try {
			await testFn()
			this.results.push({
				name,
				passed: true,
				duration: Date.now() - startTime,
			})
			console.log(`✅ ${name}`)
		} catch (error) {
			this.results.push({
				name,
				passed: false,
				error: error instanceof Error ? error.message : String(error),
				duration: Date.now() - startTime,
			})
			console.log(`❌ ${name}: ${error}`)
		}
	}

	async testInternalLLMAccess(): Promise<void> {
		await this.runTest("Internal vLLM Server Access", async () => {
			const response = await fetch(`${this.vllmUrl}/v1/models`)
			if (!response.ok) {
				throw new Error(`vLLM server responded with ${response.status}`)
			}
			const data = await response.json()
			if (!data || !Array.isArray(data.data)) {
				throw new Error("Invalid response format from vLLM")
			}
		})

		await this.runTest("Internal Ollama Server Access", async () => {
			const response = await fetch(`${this.ollamaUrl}/api/tags`)
			if (!response.ok) {
				throw new Error(`Ollama server responded with ${response.status}`)
			}
			await response.json()
		})
	}

	async testExternalAPIBlocking(): Promise<void> {
		const wrappedFetch = createFetchWrapper(fetch as any)

		const externalAPIs = [
			"https://api.openai.com/v1/models",
			"https://api.anthropic.com/v1/messages",
			"https://openrouter.ai/api/v1/models",
			"https://us.i.posthog.com/capture",
			"https://api.github.com/repos/test/test",
		]

		for (const url of externalAPIs) {
			await this.runTest(`Block External API: ${url}`, async () => {
				try {
					await wrappedFetch(url)
					throw new Error("External API call should have been blocked")
				} catch (error) {
					if (error instanceof Error && error.message.includes("ON_PREM mode")) {
						// 정상적으로 차단됨
						return
					}
					throw error
				}
			})
		}
	}

	async testTelemetryBlocking(): Promise<void> {
		await this.runTest("Telemetry Blocking", async () => {
			const telemetryClient = new OnPremTelemetryClient(false)

			if (telemetryClient.isTelemetryEnabled()) {
				throw new Error("Telemetry should be disabled in ON_PREM mode")
			}

			// 텔레메트리 호출이 무시되는지 확인
			const result = await telemetryClient.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { test: "firewall" },
			})

			if (result !== undefined) {
				throw new Error("Telemetry capture should return undefined")
			}
		})
	}

	async testVLLMChatCompletion(): Promise<void> {
		await this.runTest("vLLM Chat Completion", async () => {
			const response = await fetch(`${this.vllmUrl}/v1/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "microsoft/DialoGPT-small",
					messages: [{ role: "user", content: "Hello, how are you?" }],
					max_tokens: 50,
					temperature: 0.7,
				}),
			})

			if (!response.ok) {
				throw new Error(`vLLM chat completion failed with ${response.status}`)
			}

			const data = await response.json()
			if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
				throw new Error("Invalid chat completion response")
			}

			if (!data.choices[0].message || !data.choices[0].message.content) {
				throw new Error("No content in chat completion response")
			}
		})
	}

	async testOllamaGeneration(): Promise<void> {
		await this.runTest("Ollama Text Generation", async () => {
			// 사용 가능한 모델 확인
			const modelsResponse = await fetch(`${this.ollamaUrl}/api/tags`)
			if (!modelsResponse.ok) {
				throw new Error("Failed to fetch Ollama models")
			}

			const models = await modelsResponse.json()
			if (!models.models || models.models.length === 0) {
				// 모델이 없으면 스킵
				console.log("⚠️ No Ollama models available, skipping generation test")
				return
			}

			const modelName = models.models[0].name

			const response = await fetch(`${this.ollamaUrl}/api/generate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: modelName,
					prompt: "Hello, how are you?",
					stream: false,
				}),
			})

			if (!response.ok) {
				throw new Error(`Ollama generation failed with ${response.status}`)
			}

			const data = await response.json()
			if (!data.response) {
				throw new Error("No response from Ollama generation")
			}
		})
	}

	async testNetworkIsolation(): Promise<void> {
		await this.runTest("Network Isolation Check", async () => {
			// 파이어월 상태 확인
			const firewallResponse = await fetch("http://firewall-proxy/firewall/status")
			if (!firewallResponse.ok) {
				throw new Error("Firewall proxy not responding")
			}

			const firewallStatus = await firewallResponse.json()
			if (firewallStatus.status !== "active" || firewallStatus.mode !== "ON_PREM") {
				throw new Error("Firewall not in correct mode")
			}
		})

		await this.runTest("External Domain Resolution Block", async () => {
			try {
				// DNS 해결은 되지만 HTTP 연결이 차단되어야 함
				const response = await fetch("http://api.openai.com", {
					timeout: 5000,
				})

				// 연결이 성공하면 안됨
				if (response.ok) {
					throw new Error("External domain should be blocked")
				}
			} catch (error) {
				// 네트워크 오류나 타임아웃은 정상 (차단됨)
				if (error instanceof Error) {
					if (
						error.message.includes("timeout") ||
						error.message.includes("ENOTFOUND") ||
						error.message.includes("ECONNREFUSED")
					) {
						return // 정상적으로 차단됨
					}
				}
				throw error
			}
		})
	}

	async testPerformance(): Promise<void> {
		await this.runTest("vLLM Response Time", async () => {
			const startTime = Date.now()

			const response = await fetch(`${this.vllmUrl}/v1/models`)
			if (!response.ok) {
				throw new Error("vLLM models endpoint failed")
			}

			const duration = Date.now() - startTime
			if (duration > 5000) {
				throw new Error(`vLLM response too slow: ${duration}ms`)
			}

			console.log(`   vLLM response time: ${duration}ms`)
		})

		await this.runTest("Ollama Response Time", async () => {
			const startTime = Date.now()

			const response = await fetch(`${this.ollamaUrl}/api/tags`)
			if (!response.ok) {
				throw new Error("Ollama tags endpoint failed")
			}

			const duration = Date.now() - startTime
			if (duration > 5000) {
				throw new Error(`Ollama response too slow: ${duration}ms`)
			}

			console.log(`   Ollama response time: ${duration}ms`)
		})
	}

	async runAllTests(): Promise<void> {
		console.log("🔥 Starting Firewall Tests...")
		console.log(`📡 vLLM URL: ${this.vllmUrl}`)
		console.log(`🦙 Ollama URL: ${this.ollamaUrl}`)
		console.log(`🔒 ON_PREM Mode: ${process.env.ON_PREM}`)
		console.log("")

		// 기본 네트워크 테스트
		await this.testNetworkIsolation()

		// 내부 서비스 접근 테스트
		await this.testInternalLLMAccess()

		// 외부 API 차단 테스트
		await this.testExternalAPIBlocking()

		// 텔레메트리 차단 테스트
		await this.testTelemetryBlocking()

		// LLM 기능 테스트
		await this.testVLLMChatCompletion()
		await this.testOllamaGeneration()

		// 성능 테스트
		await this.testPerformance()

		this.printResults()
	}

	private printResults(): void {
		console.log("\n" + "=".repeat(60))
		console.log("🧪 FIREWALL TEST RESULTS")
		console.log("=".repeat(60))

		const passed = this.results.filter((r) => r.passed).length
		const failed = this.results.filter((r) => !r.passed).length
		const total = this.results.length

		console.log(`📊 Total: ${total}, Passed: ${passed}, Failed: ${failed}`)
		console.log("")

		if (failed > 0) {
			console.log("❌ FAILED TESTS:")
			this.results
				.filter((r) => !r.passed)
				.forEach((r) => {
					console.log(`   • ${r.name}: ${r.error}`)
				})
			console.log("")
		}

		console.log("⏱️  PERFORMANCE:")
		this.results.forEach((r) => {
			const status = r.passed ? "✅" : "❌"
			console.log(`   ${status} ${r.name}: ${r.duration}ms`)
		})

		console.log("\n" + "=".repeat(60))

		if (failed === 0) {
			console.log("🎉 ALL TESTS PASSED! ON_PREM mode is working correctly.")
		} else {
			console.log(`💥 ${failed} TEST(S) FAILED. Check the errors above.`)
			process.exit(1)
		}
	}
}

// 메인 실행
async function main() {
	// ON_PREM 모드 강제 활성화
	process.env.ON_PREM = "true"

	const tester = new FirewallTester()
	await tester.runAllTests()
}

if (require.main === module) {
	main().catch((error) => {
		console.error("💥 Test execution failed:", error)
		process.exit(1)
	})
}
