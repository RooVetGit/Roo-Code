# JSON File Writing Must Be Atomic

- You MUST use `safeWriteJson(filePath: string, data: any): Promise<void>` from `src/utils/safeWriteJson.ts` instead of `JSON.stringify` with file-write operations
- `safeWriteJson` will create parent directories if necessary, so do not call `mkdir` prior to `safeWriteJson`
- `safeWriteJson` prevents data corruption via atomic writes with locking and streams the write to minimize memory footprint
- Use the `readModifyFn` parameter of `safeWriteJson` to perform atomic transactions: `safeWriteJson(filePath, requiredDefaultValue, async (data) => { /* modify `data`in place and return`data` to save changes, or return undefined to cancel the operation without writing */ })`
    - When using readModifyFn with default data, it must be a modifiable type (object or array)
    - for memory efficiency, `data` must be modified in-place: prioritize the use of push/pop/splice/truncate and maintain the original reference
    - if and only if the operation being performed on `data` is impossible without new reference creation may it return a reference other than `data`
        - you must assign any new references to structures needed outside of the critical section from within readModifyFn before returning: you must avoid `obj = await safeWriteJson()` which could introduce race conditions from the non-deterministic execution ordering of await
- Test files are exempt from these rules
