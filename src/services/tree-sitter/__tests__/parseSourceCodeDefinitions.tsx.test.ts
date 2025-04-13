import { describe, expect, it, jest, beforeAll } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import tsxQuery from "../queries/tsx"
import {
	initializeTreeSitter,
	testParseSourceCodeDefinitions,
	inspectTreeStructure,
	debugLog,
	mockedFs,
} from "./helpers"

import sampleTsxContent from "./fixtures/sample-tsx"

describe("parseSourceCodeDefinitionsForFile with TSX", () => {
	// Cache test results at the top of the describe block
	let result: string

	beforeAll(async () => {
		// Set up mock for file system operations
		jest.mock("fs/promises")
		mockedFs.readFile.mockResolvedValue(Buffer.from(sampleTsxContent))

		// Cache the parse result for use in all tests
		result = await testParseSourceCodeDefinitions("test.tsx", sampleTsxContent, {
			language: "tsx",
			wasmFile: "tree-sitter-tsx.wasm",
		})
	})

	// Type Definition Tests
	it("should capture interface declarations", async () => {
		expect(result).toContain("interface StandardInterfaceProps")
		expect(result).toContain("interface PropsDefinitionExample")
		expect(result).toContain("interface ClassComponentState")
		expect(result).toContain("interface GenericComponentProps<T>")
	})

	it("should capture type alias declarations", async () => {
		expect(result).toContain("type StandardTypeAlias")
		expect(result).toContain("type UserType")
	})

	// Component Definition Tests
	it("should capture function component declarations", async () => {
		expect(result).toContain("function StandardFunctionComponent")
		expect(result).toContain("function GenericListComponent<T>")
	})

	it("should capture arrow function components", async () => {
		expect(result).toContain("ArrowFunctionComponent")
		expect(result).toContain("JSXElementsExample")
		expect(result).toContain("EventHandlersComponent")
		expect(result).toContain("HooksStateComponent")
		expect(result).toContain("HooksUsageComponent")
		expect(result).toContain("GenericComponentUsage")
	})

	it("should capture class components", async () => {
		expect(result).toContain("class StandardClassComponent extends React.Component")
	})

	it("should capture higher order components", async () => {
		expect(result).toContain("function withLogging<P extends object>")
		// Enhanced function component is created from HOC
		expect(result).toContain("withLogging")
	})

	// JSX Elements Tests
	it("should capture standard JSX elements", async () => {
		const jsxTestContent = `
		  const ComponentWithJSX = () => {
		    return (
		      <div className="container">
		        <Header title="Hello World" />
		        <Content>
		          <p>Some content here</p>
		        </Content>
		      </div>
		    );
		  };
		`

		const jsxResult = await testParseSourceCodeDefinitions("jsx-test.tsx", jsxTestContent, {
			language: "tsx",
			wasmFile: "tree-sitter-tsx.wasm",
		})

		expect(jsxResult).toContain("ComponentWithJSX")
	})

	it("should capture self-closing JSX elements and components", async () => {
		// Check if the test component exists that contains these elements
		expect(result).toContain("JSXElementsExample")
		// Verify the line range that contains our Input component appears in the output
		expect(result).toContain("130--135")
	})

	it("should capture member expression components", async () => {
		// Verify the line range that contains our UI.Button component appears in the output
		expect(result).toContain("136--142")
	})

	// State Tests
	it("should capture React hooks usage", async () => {
		// Check for hooks that are part of the output
		expect(result).toContain("React.useEffect")
		expect(result).toContain("React.useCallback")
		expect(result).toContain("React.useMemo")
	})

	it("should capture event handlers", async () => {
		expect(result).toContain("handleClick")
		expect(result).toContain("handleChange")
		expect(result).toContain("handleSubmit")
	})

	// Generic Components Tests
	it("should capture generic component declarations", async () => {
		expect(result).toContain("function GenericListComponent<T>")
		expect(result).toContain("GenericComponentProps<T>")
	})
})
