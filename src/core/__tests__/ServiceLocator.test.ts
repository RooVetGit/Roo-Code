import { ServiceLocator } from "../ServiceLocator"

describe("ServiceLocator", () => {
	beforeEach(() => {
		// Clear all services before each test
		ServiceLocator.getInstance().clear()
	})

	test("getInstance returns the same instance", () => {
		const instance1 = ServiceLocator.getInstance()
		const instance2 = ServiceLocator.getInstance()
		expect(instance1).toBe(instance2)
	})

	test("register and get service", () => {
		const serviceLocator = ServiceLocator.getInstance()
		const mockService = { name: "TestService" }

		serviceLocator.register("testService", mockService)
		const retrievedService = serviceLocator.get("testService")

		expect(retrievedService).toBe(mockService)
	})

	test("get throws error for non-existent service", () => {
		const serviceLocator = ServiceLocator.getInstance()

		expect(() => {
			serviceLocator.get("nonExistentService")
		}).toThrow("Service not registered: nonExistentService")
	})

	test("has returns true for registered service", () => {
		const serviceLocator = ServiceLocator.getInstance()
		const mockService = { name: "TestService" }

		serviceLocator.register("testService", mockService)

		expect(serviceLocator.has("testService")).toBe(true)
	})

	test("has returns false for non-existent service", () => {
		const serviceLocator = ServiceLocator.getInstance()

		expect(serviceLocator.has("nonExistentService")).toBe(false)
	})

	test("clear removes all services", () => {
		const serviceLocator = ServiceLocator.getInstance()
		const mockService1 = { name: "TestService1" }
		const mockService2 = { name: "TestService2" }

		serviceLocator.register("testService1", mockService1)
		serviceLocator.register("testService2", mockService2)

		expect(serviceLocator.has("testService1")).toBe(true)
		expect(serviceLocator.has("testService2")).toBe(true)

		serviceLocator.clear()

		expect(serviceLocator.has("testService1")).toBe(false)
		expect(serviceLocator.has("testService2")).toBe(false)
	})

	test("register overwrites existing service", () => {
		const serviceLocator = ServiceLocator.getInstance()
		const mockService1 = { name: "TestService1" }
		const mockService2 = { name: "TestService2" }

		serviceLocator.register("testService", mockService1)
		expect(serviceLocator.get("testService")).toBe(mockService1)

		serviceLocator.register("testService", mockService2)
		expect(serviceLocator.get("testService")).toBe(mockService2)
	})

	test("type safety with generics", () => {
		interface TestService {
			name: string
			doSomething(): string
		}

		const serviceLocator = ServiceLocator.getInstance()
		const mockService: TestService = {
			name: "TypedService",
			doSomething: () => "done",
		}

		serviceLocator.register<TestService>("typedService", mockService)
		const retrievedService = serviceLocator.get<TestService>("typedService")

		expect(retrievedService.name).toBe("TypedService")
		expect(retrievedService.doSomething()).toBe("done")
	})
})
