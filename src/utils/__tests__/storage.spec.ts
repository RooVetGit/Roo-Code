import * as vscode from "vscode"

vi.mock("fs/promises", async () => {
	const mod = await import("../../__mocks__/fs/promises")
	return (mod as any).default ?? mod
})

describe("getStorageBasePath - customStoragePath", () => {
	const defaultPath = "/test/global-storage"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns the configured custom path when it is writable", async () => {
		const customPath = "/test/storage/path"
		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn().mockReturnValue(customPath),
		} as any)

		const fsPromises = await import("fs/promises")
		const { getStorageBasePath } = await import("../storage")

		const result = await getStorageBasePath(defaultPath)

		expect(result).toBe(customPath)
		expect((fsPromises as any).mkdir).toHaveBeenCalledWith(customPath, { recursive: true })
		expect((fsPromises as any).access).toHaveBeenCalledWith(customPath, expect.any(Number))
	})

	it("falls back to default and shows an error when custom path is not writable", async () => {
		const customPath = "/test/storage/unwritable"

		vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
			get: vi.fn().mockReturnValue(customPath),
		} as any)

		const showErrorSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined as any)

		const fsPromises = await import("fs/promises")
		const { getStorageBasePath } = await import("../storage")

		await (fsPromises as any).mkdir(customPath, { recursive: true })

		const accessMock = (fsPromises as any).access as ReturnType<typeof vi.fn>
		accessMock.mockImplementationOnce(async (p: string) => {
			if (p === customPath) {
				const err: any = new Error("EACCES: permission denied")
				err.code = "EACCES"
				throw err
			}
			return Promise.resolve()
		})

		const result = await getStorageBasePath(defaultPath)

		expect(result).toBe(defaultPath)
		expect(showErrorSpy).toHaveBeenCalledTimes(1)
		const firstArg = showErrorSpy.mock.calls[0][0]
		expect(typeof firstArg).toBe("string")
	})
})
