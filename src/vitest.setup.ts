// Vitest setup file
import "./utils/path" // Import to enable String.prototype.toPosix()

// Mock fs/promises for tests that need it
import { vi } from "vitest"

// Global mocks that many tests expect
global.structuredClone = global.structuredClone || ((obj: any) => JSON.parse(JSON.stringify(obj)))
