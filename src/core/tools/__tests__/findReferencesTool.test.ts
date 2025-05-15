// npx jest src/core/tools/__tests__/findReferencesTool.test.ts

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { Task } from "../../task/Task"
import { FindReferencesToolUse, ToolResponse } from "../../../shared/tools"
import { findReferencesTool } from "../findReferencesTool"
import { hasLanguageServices } from "../../../services/language-services"

// We're not mocking VS Code or language services - we want to test the real implementation

describe("findReferencesTool with real language services", () => {
  // Path to the test C# file
  const testFilePath = path.join(__dirname, "fixtures", "TestClass.cs")
  const csharpContent = `
using System;

namespace TestNamespace
{
    public class TestClass
    {
        private int _testField;
        
        public void TestMethod()
        {
            Console.WriteLine(_testField);
        }
        
        public void AnotherMethod()
        {
            _testField = 42;
            TestMethod();
        }
    }
}`

  // Create the test file before running tests
  beforeAll(async () => {
    // Ensure the fixtures directory exists
    const fixturesDir = path.join(__dirname, "fixtures")
    try {
      await fs.mkdir(fixturesDir, { recursive: true })
    } catch (err) {
      // Directory might already exist
    }
    
    // Write the test file
    await fs.writeFile(testFilePath, csharpContent, "utf8")
  })
  
  // Clean up after tests
  afterAll(async () => {
    try {
      await fs.unlink(testFilePath)
    } catch (err) {
      // File might not exist
    }
  })
  
  // Test instances
  const mockTask: Partial<Task> = {
    cwd: __dirname,
  }
  let toolResult: ToolResponse | undefined
  
  // Helper function to execute the tool
  async function executeReferencesTool(
    params: Partial<FindReferencesToolUse["params"]> = {}
  ): Promise<ToolResponse | undefined> {
    // Create tool use object
    const toolUse: FindReferencesToolUse = {
      type: "tool_use",
      name: "find_references",
      params: {
        symbol: "_testField",
        file_path: testFilePath,
        ...params,
      },
      partial: false,
    }
    
    // Mock approval function
    const mockAskApproval = jest.fn().mockResolvedValue(true)
    
    // Execute the tool
    await findReferencesTool(
      mockTask as Task,
      toolUse,
      (result: ToolResponse) => {
        toolResult = result
      },
      mockAskApproval
    )
    
    return toolResult
  }
  
  // Tests for C# symbol references
  describe("C# symbol references", () => {
    it("should find references to a C# field", async () => {
      // Skip this test if language services aren't available
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath))
      const hasServices = await hasLanguageServices(document)
      if (!hasServices) {
        console.log("Skipping test: Language services not available for C# files")
        return
      }
      
      // Execute
      const result = await executeReferencesTool({ symbol: "_testField" })
      
      // Verify
      expect(result).toContain("<file><path>")
      expect(result).toContain("_testField")
    })
    
    it("should handle C# symbol with namespace prefix", async () => {
      // Skip this test if language services aren't available
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath))
      const hasServices = await hasLanguageServices(document)
      if (!hasServices) {
        console.log("Skipping test: Language services not available for C# files")
        return
      }
      
      // Execute
      const result = await executeReferencesTool({
        symbol: "TestNamespace.TestClass",
        file_path: testFilePath
      })
      
      // Verify - we're just checking that it doesn't throw an error
      expect(result).toBeDefined()
    })
    
    it("should handle C# method references", async () => {
      // Skip this test if language services aren't available
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath))
      const hasServices = await hasLanguageServices(document)
      if (!hasServices) {
        console.log("Skipping test: Language services not available for C# files")
        return
      }
      
      // Execute
      const result = await executeReferencesTool({
        symbol: "TestMethod",
        file_path: testFilePath
      })
      
      // Verify - we're just checking that it doesn't throw an error
      expect(result).toBeDefined()
    })
    
    it("should handle line_number parameter for C# symbols", async () => {
      // Skip this test if language services aren't available
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath))
      const hasServices = await hasLanguageServices(document)
      if (!hasServices) {
        console.log("Skipping test: Language services not available for C# files")
        return
      }
      
      // Execute with line_number parameter
      const result = await executeReferencesTool({
        symbol: "_testField",
        file_path: testFilePath,
        line_number: "7" // Line with private int _testField
      })
      
      // Verify - we're just checking that it doesn't throw an error
      expect(result).toBeDefined()
    })
    
    it("should handle when no references are found", async () => {
      // Skip this test if language services aren't available
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath))
      const hasServices = await hasLanguageServices(document)
      if (!hasServices) {
        console.log("Skipping test: Language services not available for C# files")
        return
      }
      
      // Execute
      const result = await executeReferencesTool({
        symbol: "NonExistentSymbol",
        file_path: testFilePath
      })
      
      // Verify
      expect(result).toContain("No references found for 'NonExistentSymbol'")
    })
  })
})