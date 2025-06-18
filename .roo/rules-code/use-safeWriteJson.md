# JSON File Writing Must Be Atomic

- You MUST use `safeWriteJson(filePath: string, data: any): Promise<void>` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` with file-write operations
- `safeWriteJson` will create parent directories if necessary, so do not call `mkdir` prior to `safeWriteJson`
- `safeWriteJson` prevents data corruption via atomic writes with locking and streams the write to minimize memory footprint
- For read-modify-write operations, use the `readModifyFn` parameter of `safeWriteJson` to perform atomic transactions: `safeWriteJson(filePath, undefined, async (data) => { /* modify data in place and return true to save changes or return false to skip the write */ })`
- Test files are exempt from this rule
