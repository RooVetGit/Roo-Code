#!/usr/bin/env tsx

/**
 * Local LLM 벤치마크 스크립트
 * vLLM vs Ollama 성능 비교
 *
 * 사용법:
 * npm run benchmark-local-llm
 *
 * 환경변수:
 * VLLM_URL=http://gpu-srv:8000 npm run benchmark-local-llm
 * OLLAMA_URL=http://localhost:11434 npm run benchmark-local-llm
 */

import { performance } from "perf_hooks"

interface BenchmarkConfig {
	vllmUrl: string
	ollamaUrl: string
	model: string
	testPrompts: string[]
	iterations: number
}

interface BenchmarkResult {
	provider: "vLLM" | "Ollama"
	url: string
	model: string
	avgResponseTime: number
	minResponseTime: number
	maxResponseTime: number
	tokensPerSecond: number
	successRate: number
	errors: string[]
}

interface TestResult {
	success: boolean
	responseTime: number
	tokenCount: number
	error?: string
}

/**
 * HTTP 요청 벤치마크
 */
async function benchmarkProvider(
	providerName: "vLLM" | "Ollama",
	baseUrl: string,
	model: string,
	prompts: string[],
	iterations: number,
): Promise<BenchmarkResult> {
	const results: TestResult[] = []
	const errors: string[] = []

	console.log(`\n🚀 ${providerName} 벤치마크 시작 (${baseUrl})`)
	console.log(`모델: ${model}, 반복: ${iterations}회`)

	for (let i = 0; i < iterations; i++) {
		const prompt = prompts[i % prompts.length]

		try {
			const result = await testSingleRequest(providerName, baseUrl, model, prompt)
			results.push(result)

			if (result.success) {
				process.stdout.write("✅ ")
			} else {
				process.stdout.write("❌ ")
				if (result.error) {
					errors.push(result.error)
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			errors.push(errorMsg)
			results.push({
				success: false,
				responseTime: 0,
				tokenCount: 0,
				error: errorMsg,
			})
			process.stdout.write("💥 ")
		}

		// 요청 간 간격
		if (i < iterations - 1) {
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	}

	console.log() // 줄바꿈

	// 성공한 결과만 계산
	const successResults = results.filter((r) => r.success)
	const responseTimes = successResults.map((r) => r.responseTime)
	const tokenCounts = successResults.map((r) => r.tokenCount)

	if (successResults.length === 0) {
		return {
			provider: providerName,
			url: baseUrl,
			model,
			avgResponseTime: 0,
			minResponseTime: 0,
			maxResponseTime: 0,
			tokensPerSecond: 0,
			successRate: 0,
			errors,
		}
	}

	const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
	const totalTokens = tokenCounts.reduce((a, b) => a + b, 0)
	const totalTime = responseTimes.reduce((a, b) => a + b, 0) / 1000 // 초 단위

	return {
		provider: providerName,
		url: baseUrl,
		model,
		avgResponseTime,
		minResponseTime: Math.min(...responseTimes),
		maxResponseTime: Math.max(...responseTimes),
		tokensPerSecond: totalTime > 0 ? totalTokens / totalTime : 0,
		successRate: (successResults.length / results.length) * 100,
		errors,
	}
}

/**
 * 단일 요청 테스트
 */
async function testSingleRequest(
	provider: "vLLM" | "Ollama",
	baseUrl: string,
	model: string,
	prompt: string,
): Promise<TestResult> {
	const startTime = performance.now()

	try {
		let apiUrl: string
		let requestBody: any

		if (provider === "vLLM") {
			// vLLM OpenAI 호환 API
			apiUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`

			requestBody = {
				model,
				messages: [{ role: "user", content: prompt }],
				max_tokens: 100,
				temperature: 0.7,
			}
		} else {
			// Ollama API
			apiUrl = baseUrl.endsWith("/api") ? `${baseUrl}/generate` : `${baseUrl}/api/generate`

			requestBody = {
				model,
				prompt,
				stream: false,
				options: {
					num_predict: 100,
					temperature: 0.7,
				},
			}
		}

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(30000), // 30초 타임아웃
		})

		const endTime = performance.now()
		const responseTime = endTime - startTime

		if (!response.ok) {
			return {
				success: false,
				responseTime,
				tokenCount: 0,
				error: `HTTP ${response.status}: ${response.statusText}`,
			}
		}

		const data = await response.json()
		let tokenCount = 0

		if (provider === "vLLM") {
			// OpenAI 형식 응답
			tokenCount = data.usage?.completion_tokens || 0
		} else {
			// Ollama 응답에서 토큰 추정 (공백 기준)
			const responseText = data.response || ""
			tokenCount = responseText.split(/\s+/).length
		}

		return {
			success: true,
			responseTime,
			tokenCount,
		}
	} catch (error) {
		const endTime = performance.now()
		return {
			success: false,
			responseTime: endTime - startTime,
			tokenCount: 0,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * 결과 출력
 */
function printResults(results: BenchmarkResult[]) {
	console.log("\n" + "=".repeat(80))
	console.log("📊 벤치마크 결과")
	console.log("=".repeat(80))

	results.forEach((result) => {
		console.log(`\n🤖 ${result.provider} (${result.url})`)
		console.log(`모델: ${result.model}`)
		console.log(`성공률: ${result.successRate.toFixed(1)}%`)

		if (result.successRate > 0) {
			console.log(`평균 응답시간: ${result.avgResponseTime.toFixed(2)}ms`)
			console.log(`최소 응답시간: ${result.minResponseTime.toFixed(2)}ms`)
			console.log(`최대 응답시간: ${result.maxResponseTime.toFixed(2)}ms`)
			console.log(`토큰/초: ${result.tokensPerSecond.toFixed(2)}`)
		}

		if (result.errors.length > 0) {
			console.log(`오류 (최대 3개): ${result.errors.slice(0, 3).join(", ")}`)
		}
	})

	// 비교 결과
	if (results.length === 2) {
		const [first, second] = results
		console.log(`\n🏆 비교 결과`)

		if (first.successRate > second.successRate) {
			console.log(
				`성공률: ${first.provider} 승 (${first.successRate.toFixed(1)}% vs ${second.successRate.toFixed(1)}%)`,
			)
		} else if (second.successRate > first.successRate) {
			console.log(
				`성공률: ${second.provider} 승 (${second.successRate.toFixed(1)}% vs ${first.successRate.toFixed(1)}%)`,
			)
		} else {
			console.log(`성공률: 동점 (${first.successRate.toFixed(1)}%)`)
		}

		if (first.avgResponseTime < second.avgResponseTime) {
			console.log(
				`응답속도: ${first.provider} 승 (${first.avgResponseTime.toFixed(2)}ms vs ${second.avgResponseTime.toFixed(2)}ms)`,
			)
		} else if (second.avgResponseTime < first.avgResponseTime) {
			console.log(
				`응답속도: ${second.provider} 승 (${second.avgResponseTime.toFixed(2)}ms vs ${first.avgResponseTime.toFixed(2)}ms)`,
			)
		}

		if (first.tokensPerSecond > second.tokensPerSecond) {
			console.log(
				`처리량: ${first.provider} 승 (${first.tokensPerSecond.toFixed(2)} vs ${second.tokensPerSecond.toFixed(2)} 토큰/초)`,
			)
		} else if (second.tokensPerSecond > first.tokensPerSecond) {
			console.log(
				`처리량: ${second.provider} 승 (${second.tokensPerSecond.toFixed(2)} vs ${first.tokensPerSecond.toFixed(2)} 토큰/초)`,
			)
		}
	}
}

/**
 * 메인 실행 함수
 */
async function main() {
	const config: BenchmarkConfig = {
		vllmUrl: process.env.VLLM_URL || "http://localhost:8000",
		ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
		model: process.env.MODEL || "llama2",
		iterations: parseInt(process.env.ITERATIONS || "10"),
		testPrompts: [
			"Hello, how are you?",
			"Explain quantum computing in simple terms.",
			"Write a short Python function to calculate fibonacci numbers.",
			"What are the benefits of renewable energy?",
			"Describe the water cycle process.",
		],
	}

	console.log("🎯 Local LLM 벤치마크 도구")
	console.log(`vLLM: ${config.vllmUrl}`)
	console.log(`Ollama: ${config.ollamaUrl}`)
	console.log(`모델: ${config.model}`)
	console.log(`반복: ${config.iterations}회`)

	const results: BenchmarkResult[] = []

	// vLLM 벤치마크
	try {
		const vllmResult = await benchmarkProvider(
			"vLLM",
			config.vllmUrl,
			config.model,
			config.testPrompts,
			config.iterations,
		)
		results.push(vllmResult)
	} catch (error) {
		console.error(`❌ vLLM 벤치마크 실패: ${error}`)
	}

	// Ollama 벤치마크
	try {
		const ollamaResult = await benchmarkProvider(
			"Ollama",
			config.ollamaUrl,
			config.model,
			config.testPrompts,
			config.iterations,
		)
		results.push(ollamaResult)
	} catch (error) {
		console.error(`❌ Ollama 벤치마크 실패: ${error}`)
	}

	// 결과 출력
	printResults(results)
}

// 스크립트 실행
if (require.main === module) {
	main().catch((error) => {
		console.error("벤치마크 실행 오류:", error)
		process.exit(1)
	})
}
