import { describe, it, expect, beforeAll, vi } from "vitest"
import { CodeParser } from "../processors/parser"
import * as languageParserModule from "../../tree-sitter/languageParser"
import * as path from "path"

describe("Go Indexing Fix", () => {
	let wasmDir: string | undefined

	beforeAll(async () => {
		// Find WASM directory
		const possibleWasmDirs = [path.join(__dirname, "../../../dist"), path.join(process.cwd(), "dist")]

		for (const dir of possibleWasmDirs) {
			try {
				const fsSync = require("fs")
				const wasmPath = path.join(dir, "tree-sitter-go.wasm")
				if (fsSync.existsSync(wasmPath)) {
					wasmDir = dir
					break
				}
			} catch (e) {
				// Continue searching
			}
		}

		if (!wasmDir) {
			throw new Error("Could not find WASM directory")
		}

		// Mock loadRequiredLanguageParsers to use our WASM directory
		const originalLoad = languageParserModule.loadRequiredLanguageParsers
		vi.spyOn(languageParserModule, "loadRequiredLanguageParsers").mockImplementation(
			async (files: string[], customWasmDir?: string) => {
				return originalLoad(files, customWasmDir || wasmDir)
			},
		)
	})

	it("should correctly index Go functions, methods, and types", async () => {
		const parser = new CodeParser()

		const goContent = `package main

import (
    "fmt"
    "strings"
)

// User represents a user in the system
type User struct {
    ID       int
    Name     string
    Email    string
    IsActive bool
}

// NewUser creates a new user instance
func NewUser(id int, name, email string) *User {
    return &User{
        ID:       id,
        Name:     name,
        Email:    email,
        IsActive: true,
    }
}

// GetDisplayName returns the user's display name
func (u *User) GetDisplayName() string {
    return fmt.Sprintf("%s <%s>", u.Name, u.Email)
}

// Validate checks if the user data is valid
func (u *User) Validate() error {
    if u.Name == "" {
        return fmt.Errorf("name cannot be empty")
    }
    if !strings.Contains(u.Email, "@") {
        return fmt.Errorf("invalid email format")
    }
    return nil
}

// ProcessUsers processes a list of users
func ProcessUsers(users []*User) {
    for _, user := range users {
        if err := user.Validate(); err != nil {
            fmt.Printf("Invalid user %d: %v\n", user.ID, err)
            continue
        }
        fmt.Println(user.GetDisplayName())
    }
}

func main() {
    users := []*User{
        NewUser(1, "Alice", "alice@example.com"),
        NewUser(2, "Bob", "bob@example.com"),
    }
    ProcessUsers(users)
}`

		const blocks = await parser.parseFile("test.go", {
			content: goContent,
			fileHash: "test-hash",
		})

		// Verify we got blocks
		expect(blocks.length).toBeGreaterThan(0)

		// Check for specific function declarations
		const functionBlocks = blocks.filter((b) => b.type === "function_declaration")
		const functionNames = functionBlocks.map((b) => b.identifier).sort()
		expect(functionNames).toContain("NewUser")
		expect(functionNames).toContain("ProcessUsers")
		// Note: main function might be filtered out if it's less than 50 characters

		// Check for method declarations
		const methodBlocks = blocks.filter((b) => b.type === "method_declaration")
		const methodNames = methodBlocks.map((b) => b.identifier).sort()
		expect(methodNames).toContain("GetDisplayName")
		expect(methodNames).toContain("Validate")

		// Check for type declarations
		const typeBlocks = blocks.filter((b) => b.type === "type_declaration")
		expect(typeBlocks.length).toBeGreaterThan(0)

		// Verify content is captured correctly
		const newUserBlock = functionBlocks.find((b) => b.identifier === "NewUser")
		expect(newUserBlock).toBeDefined()
		expect(newUserBlock!.content).toContain("func NewUser")
		expect(newUserBlock!.content).toContain("return &User{")

		// Verify line numbers are correct
		const validateBlock = methodBlocks.find((b) => b.identifier === "Validate")
		expect(validateBlock).toBeDefined()
		expect(validateBlock!.start_line).toBeGreaterThan(1)
		expect(validateBlock!.end_line).toBeGreaterThan(validateBlock!.start_line)
	})

	it("should respect the 50-character threshold for Go", async () => {
		const parser = new CodeParser()

		const goContent = `package main

// Short function - should be filtered out
func f() {
    return
}

// Longer function - should be included
func calculateTotal(items []int) int {
    total := 0
    for _, item := range items {
        total += item
    }
    return total
}`

		const blocks = await parser.parseFile("test.go", {
			content: goContent,
			fileHash: "test-hash",
		})

		// The short function should be filtered out
		const functionBlocks = blocks.filter((b) => b.type === "function_declaration")
		expect(functionBlocks.length).toBe(1)
		expect(functionBlocks[0].identifier).toBe("calculateTotal")

		// Verify the short function was not included
		const shortFunction = functionBlocks.find((b) => b.identifier === "f")
		expect(shortFunction).toBeUndefined()
	})

	it("should capture full declaration content, not just identifiers", async () => {
		const parser = new CodeParser()

		const goContent = `package main

type Config struct {
    Host     string
    Port     int
    Debug    bool
    Timeout  int
}

func (c *Config) GetAddress() string {
    return fmt.Sprintf("%s:%d", c.Host, c.Port)
}`

		const blocks = await parser.parseFile("test.go", {
			content: goContent,
			fileHash: "test-hash",
		})

		// Check that we capture the full struct declaration
		const typeBlock = blocks.find((b) => b.type === "type_declaration")
		if (typeBlock) {
			expect(typeBlock.content).toContain("type Config struct")
			expect(typeBlock.content).toContain("Host     string")
			expect(typeBlock.content).toContain("Port     int")
			expect(typeBlock.content).toContain("Debug    bool")
			expect(typeBlock.content).toContain("Timeout  int")
		}

		// Check that we capture the full method declaration
		const methodBlock = blocks.find((b) => b.type === "method_declaration" && b.identifier === "GetAddress")
		expect(methodBlock).toBeDefined()
		expect(methodBlock!.content).toContain("func (c *Config) GetAddress() string")
		expect(methodBlock!.content).toContain("return fmt.Sprintf")
	})
})
