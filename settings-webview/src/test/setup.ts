import { expect, afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom"

// Runs a cleanup after each test case
afterEach(() => {
	cleanup()
})

// Extend Vitest's expect method with methods from react-testing-library
expect.extend({})
