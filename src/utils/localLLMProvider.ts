import * as vscode from "vscode"
import type { ProviderSettings } from "@roo-code/types"

export interface LocalLLMConfig {
	type: "vllm" | "ollama"
	url: string
	model?: string
	apiKey?: string
}

/**
 * VS Code 설정에서 로컬 LLM 구성을 읽어옵니다
 */
export function getLocalLLMConfig(): LocalLLMConfig | null {
	const config = vscode.workspace.getConfiguration("roo-cline")
	const localLLM = config.get<LocalLLMConfig>("localLLM")

	if (!localLLM || !localLLM.type || !localLLM.url) {
		return null
	}

	return {
		type: localLLM.type,
		url: localLLM.url,
		model: localLLM.model,
		apiKey: localLLM.apiKey,
	}
}

/**
 * 온프레미스 모드가 활성화되어 있는지 확인합니다
 */
export function isOnPremModeEnabled(): boolean {
	return process.env.ON_PREM === "true"
}

/**
 * 로컬 LLM 설정을 ProviderSettings로 변환합니다
 */
export function createLocalLLMProviderSettings(
	localConfig: LocalLLMConfig,
	baseSettings?: Partial<ProviderSettings>,
): ProviderSettings {
	const commonSettings: Partial<ProviderSettings> = {
		...baseSettings,
		apiKey: localConfig.apiKey || "",
	}

	switch (localConfig.type) {
		case "vllm":
			return {
				...commonSettings,
				apiProvider: "vllm",
				vllmBaseUrl: localConfig.url,
				vllmModelId: localConfig.model || "llama-2-7b-chat",
			} as ProviderSettings

		case "ollama":
			return {
				...commonSettings,
				apiProvider: "ollama",
				ollamaBaseUrl: localConfig.url,
				ollamaModelId: localConfig.model || "llama2",
			} as ProviderSettings

		default:
			throw new Error(`Unsupported local LLM type: ${localConfig.type}`)
	}
}

/**
 * 온프레미스 모드에서 로컬 LLM 설정을 자동으로 적용합니다
 * 온프레미스 모드가 아니거나 로컬 LLM 설정이 없으면 원래 설정을 반환합니다
 */
export function applyLocalLLMIfOnPrem(originalSettings: ProviderSettings): ProviderSettings {
	// 온프레미스 모드가 아니면 원래 설정 유지
	if (!isOnPremModeEnabled()) {
		return originalSettings
	}

	// 로컬 LLM 설정 확인
	const localConfig = getLocalLLMConfig()
	if (!localConfig) {
		console.warn(
			"[ON_PREM] 온프레미스 모드가 활성화되었지만 localLLM 설정이 없습니다. " +
				"VS Code 설정에서 roo-cline.localLLM을 구성해주세요.",
		)
		return originalSettings
	}

	// 로컬 LLM 설정으로 변환
	try {
		const localSettings = createLocalLLMProviderSettings(localConfig, originalSettings)
		console.info(`[ON_PREM] 로컬 LLM 제공자로 전환: ${localConfig.type} (${localConfig.url})`)
		return localSettings
	} catch (error) {
		console.error(`[ON_PREM] 로컬 LLM 설정 오류: ${error}`)
		return originalSettings
	}
}

/**
 * 로컬 LLM 연결 상태를 확인합니다
 */
export async function validateLocalLLMConnection(config: LocalLLMConfig): Promise<boolean> {
	try {
		let testUrl: string

		switch (config.type) {
			case "vllm":
				// vLLM의 /v1/models 엔드포인트 확인
				testUrl = config.url.endsWith("/v1") ? `${config.url}/models` : `${config.url}/v1/models`
				break

			case "ollama":
				// Ollama의 /api/tags 엔드포인트 확인
				testUrl = config.url.endsWith("/api") ? `${config.url}/tags` : `${config.url}/api/tags`
				break

			default:
				return false
		}

		const response = await fetch(testUrl, {
			method: "GET",
			headers: {
				...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
			},
			// 온프레미스 환경에서 빠른 실패를 위해 타임아웃 설정
			signal: AbortSignal.timeout(5000),
		})

		return response.ok
	} catch (error) {
		console.warn(`로컬 LLM 연결 확인 실패 (${config.type}): ${error}`)
		return false
	}
}
