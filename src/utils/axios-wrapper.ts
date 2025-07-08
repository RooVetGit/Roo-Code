import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"
import { isOnPremMode } from "./fetch-wrapper"

/**
 * Checks if a URL is allowed in ON_PREM mode (reuse from fetch-wrapper)
 */
function isAllowedUrl(url: string): boolean {
	// Allow relative URLs
	if (!url.startsWith("http://") && !url.startsWith("https://")) {
		return true
	}

	try {
		const urlObj = new URL(url)
		const hostname = urlObj.hostname.toLowerCase()

		// Allow localhost and loopback addresses
		if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
			return true
		}

		// Allow internal network hostnames (no dots = internal DNS)
		if (!hostname.includes(".")) {
			return true
		}

		// Allow private IP ranges
		const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
		const ipMatch = hostname.match(ipv4Regex)
		if (ipMatch) {
			const [, a, b, c, d] = ipMatch.map(Number)

			// Private IP ranges
			if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
				return true
			}
		}

		// Block all other external URLs
		return false
	} catch {
		// If URL parsing fails, allow it (might be relative)
		return true
	}
}

/**
 * Creates an axios wrapper that blocks external calls in ON_PREM mode
 */
export function createAxiosWrapper(
	originalAxios: AxiosInstance,
	errorMessage: string = "ON_PREM mode: External HTTP calls are disabled",
): AxiosInstance {
	function validateUrl(url: string): void {
		if (isOnPremMode() && !isAllowedUrl(url)) {
			throw new Error(errorMessage)
		}
	}

	function validateConfig(config: AxiosRequestConfig): void {
		if (config.url) {
			validateUrl(config.url)
		}
	}

	return {
		...originalAxios,

		async get<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
			validateUrl(url)
			return originalAxios.get(url, config)
		},

		async post<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> {
			validateUrl(url)
			return originalAxios.post(url, data, config)
		},

		async put<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> {
			validateUrl(url)
			return originalAxios.put(url, data, config)
		},

		async delete<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
			validateUrl(url)
			return originalAxios.delete(url, config)
		},

		async patch<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> {
			validateUrl(url)
			return originalAxios.patch(url, data, config)
		},

		async request<T = any, R = AxiosResponse<T>>(config: AxiosRequestConfig): Promise<R> {
			validateConfig(config)
			return originalAxios.request(config)
		},

		// Include other axios properties
		defaults: originalAxios.defaults,
		interceptors: originalAxios.interceptors,
		getUri: originalAxios.getUri,
	} as AxiosInstance
}

/**
 * Replace axios imports with wrapped version for ON_PREM mode
 */
export function wrapAxiosInstance(axiosInstance: AxiosInstance): AxiosInstance {
	return createAxiosWrapper(axiosInstance)
}
