import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { ClineMessage } from "@roo-code/types"

import { waitUntilCompleted, sleep } from "../utils"

suite("Roo Code list_code_definition_names Tool", () => {
	let workspaceDir: string
	let testFiles: {
		tsFile: string
		jsFile: string
		pyFile: string
		goFile: string
		emptyFile: string
		nestedTsFile: string
		testDir: string
		nestedDir: string
	}
	let taskId: string

	// Create test files before all tests
	suiteSetup(async () => {
		// Get workspace directory
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folder found")
		}
		workspaceDir = workspaceFolders[0]!.uri.fsPath

		// Create test directory structure
		const testDirName = `test-definitions-${Date.now()}`
		const testDir = path.join(workspaceDir, testDirName)
		const nestedDir = path.join(testDir, "nested")
		await fs.mkdir(testDir, { recursive: true })
		await fs.mkdir(nestedDir, { recursive: true })

		// Define test file paths - all files go in the test directory
		testFiles = {
			tsFile: path.join(testDir, `definitions.ts`),
			jsFile: path.join(testDir, `functions.js`),
			pyFile: path.join(testDir, `classes.py`),
			goFile: path.join(testDir, `structs.go`),
			emptyFile: path.join(testDir, `empty.txt`),
			nestedTsFile: path.join(nestedDir, `nested-definitions.ts`),
			testDir: testDir,
			nestedDir: nestedDir,
		}

		// Create TypeScript file with various definitions
		await fs.writeFile(
			testFiles.tsFile,
			`// TypeScript definitions test file
export interface User {
	id: number
	name: string
	email: string
	isActive: boolean
}

export interface Product {
	id: number
	title: string
	price: number
	category: string
}

export class UserService {
	private users: User[] = []

	async getUser(id: number): Promise<User | undefined> {
		return this.users.find(u => u.id === id)
	}
	
	async createUser(user: User): Promise<void> {
		this.users.push(user)
	}

	async updateUser(id: number, updates: Partial<User>): Promise<void> {
		const index = this.users.findIndex(u => u.id === id)
		if (index !== -1) {
			this.users[index] = { ...this.users[index], ...updates }
		}
	}
}

export function calculateDiscount(price: number, percentage: number): number {
	return price * (1 - percentage / 100)
}

export const API_ENDPOINT = "https://api.example.com"
export const MAX_RETRIES = 3

type Status = "active" | "inactive" | "pending"

enum OrderStatus {
	Pending = "PENDING",
	Processing = "PROCESSING",
	Completed = "COMPLETED",
	Cancelled = "CANCELLED"
}`,
		)

		// Create JavaScript file with functions and classes
		await fs.writeFile(
			testFiles.jsFile,
			`// JavaScript functions test file
function calculateTotal(items) {
	return items.reduce((sum, item) => sum + item.price, 0)
}

function validateEmail(email) {
	const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
	return emailRegex.test(email)
}

class ShoppingCart {
	constructor() {
		this.items = []
	}

	addItem(item) {
		this.items.push(item)
	}

	removeItem(itemId) {
		this.items = this.items.filter(item => item.id !== itemId)
	}

	getTotal() {
		return calculateTotal(this.items)
	}

	clear() {
		this.items = []
	}
}

const formatCurrency = (amount) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(amount)
}

// Arrow function
const multiply = (a, b) => a * b

// Async function
async function fetchUserData(userId) {
	const response = await fetch(\`/api/users/\${userId}\`)
	return response.json()
}

module.exports = {
	calculateTotal,
	validateEmail,
	ShoppingCart,
	formatCurrency,
	multiply,
	fetchUserData
}`,
		)

		// Create Python file with classes and functions
		await fs.writeFile(
			testFiles.pyFile,
			`# Python classes test file
import datetime
from typing import List, Optional, Dict

class Animal:
    """Base class for animals"""
    def __init__(self, name: str, species: str):
        self.name = name
        self.species = species
    
    def make_sound(self) -> str:
        raise NotImplementedError("Subclasses must implement make_sound")

class Dog(Animal):
    """Dog class inheriting from Animal"""
    def __init__(self, name: str, breed: str):
        super().__init__(name, "Canis familiaris")
        self.breed = breed
    
    def make_sound(self) -> str:
        return "Woof!"
    
    def fetch(self, item: str) -> str:
        return f"{self.name} fetched the {item}"

class Cat(Animal):
    """Cat class inheriting from Animal"""
    def __init__(self, name: str, color: str):
        super().__init__(name, "Felis catus")
        self.color = color
    
    def make_sound(self) -> str:
        return "Meow!"

def calculate_age(birth_date: datetime.date) -> int:
    """Calculate age from birth date"""
    today = datetime.date.today()
    age = today.year - birth_date.year
    if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
        age -= 1
    return age

def process_data(data: List[Dict[str, any]]) -> Dict[str, any]:
    """Process a list of data dictionaries"""
    result = {
        "count": len(data),
        "items": data,
        "processed_at": datetime.datetime.now().isoformat()
    }
    return result

async def fetch_remote_data(url: str) -> Optional[Dict]:
    """Async function to fetch remote data"""
    # Simulated async operation
    return {"url": url, "status": "success"}

# Global variables
MAX_CONNECTIONS = 100
DEFAULT_TIMEOUT = 30`,
		)

		// Create Go file with structs and functions
		await fs.writeFile(
			testFiles.goFile,
			`// Go structs test file
package main

import (
	"fmt"
	"time"
)

// User represents a user in the system
type User struct {
	ID        int
	Name      string
	Email     string
	CreatedAt time.Time
}

// Product represents a product
type Product struct {
	ID          int
	Name        string
	Description string
	Price       float64
	Stock       int
}

// OrderItem represents an item in an order
type OrderItem struct {
	Product  Product
	Quantity int
}

// Order represents a customer order
type Order struct {
	ID         int
	UserID     int
	Items      []OrderItem
	TotalPrice float64
	OrderDate  time.Time
	Status     string
}

// CalculateTotal calculates the total price of an order
func CalculateTotal(items []OrderItem) float64 {
	total := 0.0
	for _, item := range items {
		total += item.Product.Price * float64(item.Quantity)
	}
	return total
}

// ValidateUser validates user data
func ValidateUser(user User) error {
	if user.Name == "" {
		return fmt.Errorf("user name cannot be empty")
	}
	if user.Email == "" {
		return fmt.Errorf("user email cannot be empty")
	}
	return nil
}

// GetUserByID retrieves a user by ID
func GetUserByID(id int) (*User, error) {
	// Simulated database lookup
	return &User{
		ID:    id,
		Name:  "John Doe",
		Email: "john@example.com",
	}, nil
}

// Constants
const (
	MaxRetries     = 3
	DefaultTimeout = 30
	APIVersion     = "v1"
)

// Variables
var (
	connectionPool []string
	isInitialized  bool
)`,
		)

		// Create empty file
		await fs.writeFile(testFiles.emptyFile, "")

		// Create nested TypeScript file
		await fs.writeFile(
			testFiles.nestedTsFile,
			`// Nested TypeScript file
export class NestedService {
	private data: any[] = []

	getData(): any[] {
		return this.data
	}

	addData(item: any): void {
		this.data.push(item)
	}
}

export interface NestedConfig {
	enabled: boolean
	timeout: number
	retries: number
}

export function processNestedData(data: any[]): any[] {
	return data.filter(item => item !== null)
}`,
		)
	})

	// Clean up test files after all tests
	suiteTeardown(async () => {
		// Cancel any running tasks before cleanup
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Clean up test files
		for (const [key, filePath] of Object.entries(testFiles)) {
			if (key === "testDir" || key === "nestedDir") {
				// Skip directory entries for now
				continue
			}
			try {
				await fs.unlink(filePath)
			} catch (_error) {
				// Failed to delete file
			}
		}

		// Clean up directories
		try {
			await fs.rmdir(testFiles.nestedDir)
			await fs.rmdir(testFiles.testDir)
		} catch (_error) {
			// Failed to delete test directories
		}
	})

	// Clean up before each test
	setup(async () => {
		// Cancel any previous task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	// Clean up after each test
	teardown(async () => {
		// Cancel the current task
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		// Small delay to ensure clean state
		await sleep(100)
	})

	test("Should list code definitions from a TypeScript file", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let definitionsFound: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution and capture results
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true

					// Extract tool results from the request
					try {
						const jsonMatch = text.match(/\{.*\}/s)
						if (jsonMatch) {
							const data = JSON.parse(jsonMatch[0])

							// Check if it's the tool response
							if (data.tool === "listCodeDefinitionNames" && data.content) {
								definitionsFound = data.content
							}
							// Check if it's in the request field
							else if (data.request) {
								// Look for Result: in the request
								const resultMatch = data.request.match(/Result:\s*([\s\S]*?)(?:\n\n|$)/)
								if (resultMatch) {
									definitionsFound = resultMatch[1].trim()
								}
							}
						}
					} catch (_e) {
						// Failed to parse, ignore
					}
				}
			}

			// Also check for ask tool messages
			if (message.type === "ask" && message.ask === "tool") {
				const text = message.text || ""
				try {
					const data = JSON.parse(text)
					if (data.tool === "listCodeDefinitionNames" && data.content) {
						definitionsFound = data.content
					}
				} catch (_e) {
					// Ignore
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from TypeScript file
			const testDirName = path.basename(testFiles.testDir)
			const fileName = path.basename(testFiles.tsFile)
			const relativePath = path.join(testDirName, fileName)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `I have created a test directory "${testDirName}" in the workspace. Use the list_code_definition_names tool to analyze the TypeScript file at path "${relativePath}". This file contains interfaces (User, Product), classes (UserService), functions (calculateDiscount), and enums (OrderStatus). The file exists in the workspace.`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")

			// Log messages for debugging if definitionsFound is null
			if (!definitionsFound) {
				console.log(
					"No definitions found. Messages received:",
					messages.map((m) => ({
						type: m.type,
						say: m.say,
						ask: m.ask,
						text: m.text?.substring(0, 200) + (m.text && m.text.length > 200 ? "..." : ""),
					})),
				)
			}

			assert.ok(definitionsFound, `Should have found code definitions, but got: ${definitionsFound}`)

			// Simple verification - just check that we got some definitions
			if (definitionsFound) {
				const defs = definitionsFound as string
				// Basic checks - the tool should find some key items
				assert.ok(
					defs.includes("User"),
					`Should find User interface in definitions: ${defs.substring(0, 500)}...`,
				)
				assert.ok(
					defs.includes("calculateDiscount"),
					`Should find calculateDiscount function in definitions: ${defs.substring(0, 500)}...`,
				)
				assert.ok(defs.length > 100, `Should have substantial content, but got length: ${defs.length}`)
			}
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})

	test("Should list code definitions from a JavaScript file", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let definitionsFound: string | null = null

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names") || text.includes("listCodeDefinitionNames")) {
					toolExecuted = true
				}
			}

			// Check for tool results in ask messages
			if (message.type === "ask" && message.ask === "tool") {
				const text = message.text || ""
				try {
					const data = JSON.parse(text)
					if (data.tool === "listCodeDefinitionNames" && data.approvalState === "approved" && data.content) {
						definitionsFound = data.content
					}
				} catch (_e) {
					// Not JSON or parsing failed
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from JavaScript file
			const testDirName = path.basename(testFiles.testDir)
			const fileName = path.basename(testFiles.jsFile)
			const relativePath = path.join(testDirName, fileName)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `Use the list_code_definition_names tool to analyze the JavaScript file at path "${relativePath}". This file exists in the workspace test directory and contains functions (calculateTotal, validateEmail, fetchUserData) and a class (ShoppingCart).`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")

			// Log messages for debugging if definitionsFound is null
			if (!definitionsFound) {
				console.log(
					"No definitions found. Messages received:",
					messages.map((m) => ({
						type: m.type,
						say: m.say,
						ask: m.ask,
						text: m.text?.substring(0, 200) + (m.text && m.text.length > 200 ? "..." : ""),
					})),
				)
			}

			assert.ok(definitionsFound, `Should have found code definitions, but got: ${definitionsFound}`)

			// Simple verification
			if (definitionsFound) {
				const defs = definitionsFound as string
				// Basic checks
				assert.ok(
					defs.includes("calculateTotal"),
					`Should find calculateTotal function in definitions: ${defs.substring(0, 500)}...`,
				)
				assert.ok(
					defs.includes("ShoppingCart"),
					`Should find ShoppingCart class in definitions: ${defs.substring(0, 500)}...`,
				)
				assert.ok(defs.length > 100, `Should have substantial content, but got length: ${defs.length}`)
			}
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})

	test("Should list code definitions from a directory", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let definitionsFound: string | null = null
		let taskId: string

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names") || text.includes("listCodeDefinitionNames")) {
					toolExecuted = true
				}
			}

			// Check for tool results in ask messages
			if (message.type === "ask" && message.ask === "tool") {
				const text = message.text || ""
				try {
					const data = JSON.parse(text)
					if (data.tool === "listCodeDefinitionNames" && data.approvalState === "approved" && data.content) {
						definitionsFound = data.content
					}
				} catch (_e) {
					// Not JSON or parsing failed
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from the test directory
			const testDirName = path.basename(testFiles.testDir)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `Use the list_code_definition_names tool to analyze all files in the directory "${testDirName}". This directory exists in the workspace and contains TypeScript, JavaScript, Python, and Go source files.`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")

			// Log messages for debugging if definitionsFound is null
			if (!definitionsFound) {
				console.log(
					"No definitions found. Messages received:",
					messages.map((m) => ({
						type: m.type,
						say: m.say,
						ask: m.ask,
						text: m.text?.substring(0, 200) + (m.text && m.text.length > 200 ? "..." : ""),
					})),
				)
			}

			assert.ok(
				definitionsFound,
				`Should have found code definitions from multiple files, but got: ${definitionsFound}`,
			)

			// Simple verification - just check that multiple files were processed
			if (definitionsFound) {
				const defs = definitionsFound as string
				// Basic checks - should find at least some files
				assert.ok(
					defs.includes(".ts") || defs.includes(".js"),
					`Should include some source files in definitions: ${defs.substring(0, 500)}...`,
				)
				assert.ok(
					defs.length > 200,
					`Should have substantial content from multiple files, but got length: ${defs.length}`,
				)
			}
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})

	test("Should handle non-existent file gracefully", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let errorMessage: string | null = null
		let taskId: string

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true
				}
			}

			// Check for error or result
			if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
				const text = message.text || ""
				if (text.includes("does not exist") || text.includes("cannot be accessed") || text.includes("error")) {
					errorMessage = text
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from non-existent file
			const testDirName = path.basename(testFiles.testDir)
			const nonExistentFile = `non-existent-file-${Date.now()}.ts`
			const relativePath = path.join(testDirName, nonExistentFile)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `Use the list_code_definition_names tool to analyze the file at path "${relativePath}". This file does not exist, which is expected for this test. Please use the tool anyway and report that the file cannot be found, then complete the task.`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")
			assert.ok(errorMessage, "Should have received an error message for non-existent file")
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})

	test("Should handle empty file gracefully", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let resultMessage: string | null = null
		let taskId: string

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true
				}
			}

			// Check for result
			if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
				const text = message.text || ""
				if (text.includes("definition") || text.includes("empty") || text.includes("No")) {
					resultMessage = text
				}
			}

			// Check for tool execution and capture results
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true

					// Extract tool results from the request
					try {
						const jsonMatch = text.match(/\{"request":".*?"\}/)
						if (jsonMatch) {
							const requestData = JSON.parse(jsonMatch[0])
							if (requestData.request && requestData.request.includes("Result:")) {
								// Extract the result after "Result:"
								const resultMatch = requestData.request.match(/Result:\s*([\s\S]*?)(?:\n\n|$)/)
								if (resultMatch) {
									resultMessage = resultMatch[1].trim()
								}
							}
						}
					} catch (_e) {
						// Failed to parse, ignore
					}
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from empty file
			const testDirName = path.basename(testFiles.testDir)
			const fileName = path.basename(testFiles.emptyFile)
			const relativePath = path.join(testDirName, fileName)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `Use the list_code_definition_names tool to analyze the file at path "${relativePath}". This text file exists in the workspace test directory but is empty.`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")
			assert.ok(resultMessage, "Should have received a result message")
			// The tool should handle empty files gracefully, either returning "No definitions found" or similar
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})

	test("Should list code definitions from nested directory file", async function () {
		this.timeout(90_000)
		const api = globalThis.api
		const messages: ClineMessage[] = []
		let _taskCompleted = false
		let toolExecuted = false
		let definitionsFound: string | null = null
		let taskId: string

		// Listen for messages
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Check for tool execution
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true
				}
			}

			// Check for completion result or text messages with definitions
			if (message.type === "say" && (message.say === "completion_result" || message.say === "text")) {
				const result = message.text || ""
				if (
					result.includes("NestedService") ||
					result.includes("NestedConfig") ||
					result.includes("processNestedData") ||
					result.includes("definition")
				) {
					definitionsFound = result
				}
			}

			// Check for tool execution and capture results
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_code_definition_names")) {
					toolExecuted = true

					// Extract tool results from the request
					try {
						const jsonMatch = text.match(/\{"request":".*?"\}/)
						if (jsonMatch) {
							const requestData = JSON.parse(jsonMatch[0])
							if (requestData.request && requestData.request.includes("Result:")) {
								// Extract the result after "Result:"
								const resultMatch = requestData.request.match(/Result:\s*([\s\S]*?)(?:\n\n|$)/)
								if (resultMatch) {
									definitionsFound = resultMatch[1].trim()
								}
							}
						}
					} catch (_e) {
						// Failed to parse, ignore
					}
				}
			}
		}

		api.on("message", messageHandler)

		// Listen for task completion
		const completionHandler = (completedTaskId: string) => {
			if (completedTaskId === taskId) {
				_taskCompleted = true
			}
		}
		api.on("taskCompleted", completionHandler)

		try {
			// Start task to list code definitions from nested file
			const relativePath = path.relative(workspaceDir, testFiles.nestedTsFile)
			taskId = await api.startNewTask({
				configuration: {
					mode: "code",
					autoApprovalEnabled: true,
					alwaysAllowReadOnly: true,
				},
				text: `Use the list_code_definition_names tool to analyze the file at path "${relativePath}". This TypeScript file exists in a nested directory within the workspace test directory and contains a class (NestedService), an interface (NestedConfig), and a function (processNestedData).`,
			})

			// Wait for task completion
			await waitUntilCompleted({ api, taskId })

			// Verify results
			assert.strictEqual(toolExecuted, true, "list_code_definition_names tool should have been executed")
			assert.ok(definitionsFound, "Should have found code definitions")

			// Verify specific definitions are found
			if (definitionsFound) {
				const defs = definitionsFound as string
				assert.ok(defs.includes("NestedService"), "Should find NestedService class")
				assert.ok(defs.includes("NestedConfig"), "Should find NestedConfig interface")
				assert.ok(defs.includes("processNestedData"), "Should find processNestedData function")
			}
		} finally {
			api.off("message", messageHandler)
			api.off("taskCompleted", completionHandler)
		}
	})
})
