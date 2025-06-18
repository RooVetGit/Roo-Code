# JSON File Reading Must Be Safe and Atomic

- You MUST use `safeReadJson(filePath: string, jsonPath?: string | string[]): Promise<any>` from `src/utils/safeReadJson.ts` to read JSON files
- `safeReadJson` provides atomic file access to local files with proper locking to prevent race conditions and uses `stream-json` to read JSON files without buffering to a string
- Test files are exempt from this rule

## Correct Usage Example

This pattern replaces all manual `fs` or `vscode.workspace.fs` reads.

### ❌ Don't do this:

```typescript
// Anti-patterns: string buffering wastes memory
const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
const data = JSON.parse(await vscode.workspace.fs.readFile(fileUri));

// Anti-pattern: Unsafe existence check
if (await fileExists.. ) { /* then read */ }
```

### ✅ Use this unified pattern:

```typescript
let data
try {
	data = await safeReadJson(filePath)
} catch (error) {
	if (error.code !== "ENOENT") {
		// Handle at least ENOENT
	}
}
```
