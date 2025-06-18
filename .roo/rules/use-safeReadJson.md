# JSON File Reading Must Be Safe and Atomic

- You MUST use `safeReadJson(filePath: string, jsonPath?: string | string[]): Promise<any>` from `src/utils/safeReadJson.ts` instead of `fs.readFile` followed by `JSON.parse`
- `safeReadJson` provides atomic file access to local files with proper locking to prevent race conditions and uses `stream-json` to read JSON files without buffering to a string
- Test files are exempt from this rule
