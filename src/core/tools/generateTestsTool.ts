import * as fs from "fs/promises";
import path from "path";

import { Task } from "../../components/execution";
import { ToolUse } from "../../components/tool";
import { getReadablePath } from "../../utils/path";
import { RecordSource } from "../record";
import { Anthropic } from "@anthropic-ai/sdk";
// Import the new function for extracting symbol code
import { extractSymbolCode } from "../../services/tree-sitter";

// TODO: Define proper types for these functions if they don't exist
type AskApprovalFunc = (question: string) => Promise<boolean>;
type HandleErrorFunc = (error: Error) => void;
type PushToolResultFunc = (result: string) => void;

/**
 * Tool to generate unit tests for a specific symbol within a given file.
 *
 * It performs the following steps:
 * 1. Extracts the source code of the specified symbol using tree-sitter services.
 * 2. Constructs a prompt for an LLM, including the symbol's code and language-specific hints.
 * 3. Makes a direct call to the LLM (via `cline.api.createMessage`) to generate tests.
 * 4. Handles the LLM's streaming response.
 * 5. Pushes the generated test code (or an error message) back to the task's message flow.
 *
 * @param cline The current Task instance, providing access to API handlers and other task context.
 * @param block The ToolUse block containing parameters like `filePath` and `symbolName`.
 * @param askApproval Function to ask for user approval (not typically used by this tool as it's invoked by a command).
 * @param handleError Function to handle errors and push an error result to the task.
 * @param pushToolResult Function to push the successful result (generated tests) to the task.
 */
export async function generateTestsTool(
  cline: Task,
  block: ToolUse,
  askApproval: AskApprovalFunc, // Though not used, it's part of the standard tool signature.
  handleError: HandleErrorFunc,
  pushToolResult: PushToolResultFunc,
): Promise<void> {
  const params = block.params as { filePath?: string; symbolName?: string };
  const { filePath, symbolName } = params;

  if (!filePath) {
    handleError(new Error("Missing required parameter: filePath"));
    return;
  }

  if (!symbolName) {
    handleError(new Error("Missing required parameter: symbolName"));
    return;
  }

  const readableFilePath = getReadablePath(cline.cwd, filePath);
  // Assuming extractSymbolCode handles path resolution if necessary,
  // or expects an absolute path. For consistency, let's resolve it.
  const absoluteFilePath = path.resolve(cline.cwd, filePath);

  try {
    // Step 1: Extract the symbol's source code.
    const symbolCode = await extractSymbolCode(absoluteFilePath, symbolName, undefined);

    if (!symbolCode) {
      handleError(new Error(`Could not extract code for symbol "${symbolName}" from ${readableFilePath}. The symbol may not exist, the file type might be unsupported for symbol extraction, or the file itself may not be found.`));
      return;
    }

    // Step 2: Construct the LLM Prompt.
    const fileExtension = path.extname(filePath).toLowerCase();
    let languageHint = "";
    // Basic language hints, can be expanded for more languages or test frameworks.
    if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExtension)) {
      languageHint = "Generate Jest or Vitest style unit tests for this TypeScript/JavaScript code.";
    } else if (fileExtension === '.py') {
      languageHint = "Generate PyTest style unit tests for this Python code.";
    } else if (fileExtension === '.java') {
      languageHint = "Generate JUnit style unit tests for this Java code.";
    } else if (fileExtension === '.go') {
      languageHint = "Generate Go standard library style unit tests for this Go code.";
    } else {
      languageHint = "Generate unit tests for this code." // Generic fallback
    }

    const testGenSystemPrompt = `You are an AI assistant specialized in generating unit tests. Please generate complete, runnable unit tests for the provided code snippet. ${languageHint} Ensure the tests cover typical use cases and important edge cases. Output only the test code itself, without any surrounding explanations or markdown formatting.`;

    const userMessageForTestGen: Anthropic.Messages.MessageParam = {
      role: "user",
      content: `Please generate unit tests for the following code snippet from the file "${readableFilePath}", symbol "${symbolName}":\n\n\`\`\`\n${symbolCode}\n\`\`\`\n\n${languageHint} Output only the test code block.`,
    };

    // Step 3: Invoke the LLM.
    // We use cline.api directly here for a one-off call, separate from the main agent's conversation loop.
    // Metadata can be minimal for this specific call but should include taskId for context.
    // block.toolId is included if available from the ToolUse block.
    const stream = cline.api.createMessage(
      testGenSystemPrompt,
      [userMessageForTestGen],
      { taskId: cline.taskId, toolId: block.toolId }
    );

    // Step 4: Handle the LLM's streaming response.
    let generatedTests = "";
    let llmError: Error | null = null;

    try {
      for await (const chunk of stream) {
        if (chunk.type === "text") {
          generatedTests += chunk.text;
        } else if (chunk.type === "error") {
          // Handle API errors specifically if the stream provides them this way
          llmError = new Error(chunk.error.message);
          break;
        }
      }
    } catch (e) {
      llmError = e instanceof Error ? e : new Error(String(e));
    }

    if (llmError) {
      handleError(new Error(`LLM call failed during test generation: ${llmError.message}`));
      return;
    }

    if (!generatedTests.trim()) {
      handleError(new Error("LLM returned empty response for test generation."));
      return;
    }

    // Step 5: Push the result.
    pushToolResult(generatedTests);

  } catch (error) {
    // Catch errors from extractSymbolCode or other unexpected issues during the process.
    handleError(error as Error);
  }
}
