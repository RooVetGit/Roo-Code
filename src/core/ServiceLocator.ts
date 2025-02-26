/**
 * ServiceLocator provides a centralized registry for services in the application.
 * It follows the Service Locator pattern to manage dependencies and reduce tight coupling.
 */
export class ServiceLocator {
	private static instance: ServiceLocator
	private services: Map<string, any> = new Map()

	private constructor() {}

	/**
	 * Gets the singleton instance of the ServiceLocator.
	 * @returns The ServiceLocator instance
	 */
	static getInstance(): ServiceLocator {
		if (!ServiceLocator.instance) {
			ServiceLocator.instance = new ServiceLocator()
		}
		return ServiceLocator.instance
	}

	/**
	 * Registers a service with the ServiceLocator.
	 * @param key The key to register the service under
	 * @param service The service instance to register
	 */
	register<T>(key: string, service: T): void {
		this.services.set(key, service)
	}

	/**
	 * Gets a service from the ServiceLocator.
	 * @param key The key of the service to retrieve
	 * @returns The service instance
	 * @throws Error if the service is not registered
	 */
	get<T>(key: string): T {
		const service = this.services.get(key)
		if (!service) {
			throw new Error(`Service not registered: ${key}`)
		}
		return service as T
	}

	/**
	 * Checks if a service is registered with the ServiceLocator.
	 * @param key The key to check
	 * @returns True if the service is registered, false otherwise
	 */
	has(key: string): boolean {
		return this.services.has(key)
	}

	/**
	 * Clears all registered services.
	 * Primarily used for testing.
	 */
	clear(): void {
		this.services.clear()
	}
}
