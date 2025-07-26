import * as vscode from "vscode"
import { getNewDiagnostics } from ".."

vi.mock("vscode", async () => {
	const originalModule = await vi.importActual("vscode");
	const mock = {
		...originalModule,
		DiagnosticSeverity: {
			Error: 0,
			Warning: 1,
			Information: 2,
			Hint: 3,
		},
		Range: class {
			start: { line: number; character: number };
			end: { line: number; character: number };

			constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) {
				this.start = { line: startLine, character: startChar };
				this.end = { line: endLine, character: endChar };
			}
		},
		Diagnostic: class {
			constructor(public range: any, public message: string, public severity: number, public source?: string) {}
		},
		Uri: {
			file: (path: string) => ({
				path,
				fsPath: path,
				toString: () => path,
			}),
		},
	};
	return mock;
});

describe("getNewDiagnostics", () => {
	it("should return an empty list if there are no new diagnostics", () => {
		const oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
			[vscode.Uri.file("/path/to/file1.ts"), [
				new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "Old error in file1", vscode.DiagnosticSeverity.Error)
			]],
		];
		const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
			[vscode.Uri.file("/path/to/file1.ts"), [
				new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "Old error in file1", vscode.DiagnosticSeverity.Error)
			]],
		];

		const { problems, warnings } = getNewDiagnostics(oldDiagnostics, newDiagnostics);
		expect(problems).toEqual([]);
		expect(warnings).toEqual([]);
	});

	it("should identify new fatal errors", () => {
		const oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
		const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
			[vscode.Uri.file("/path/to/file1.ts"), [
				new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "New fatal error", vscode.DiagnosticSeverity.Error, "typescript")
			]],
		];

		const { problems, warnings } = getNewDiagnostics(oldDiagnostics, newDiagnostics);
		expect(problems).toHaveLength(1);
		expect(warnings).toHaveLength(0);
		expect(problems[0][1][0].message).toBe("New fatal error");
	});

	it("should identify new linter warnings", () => {
		const oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
		const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
			[vscode.Uri.file("/path/to/file1.ts"), [
				new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "New linter warning", vscode.DiagnosticSeverity.Error, "pylance")
			]],
		];

		const { problems, warnings } = getNewDiagnostics(oldDiagnostics, newDiagnostics);
		expect(problems).toHaveLength(0);
		expect(warnings).toHaveLength(1);
		expect(warnings[0][1][0].message).toBe("New linter warning");
	});

	it("should correctly categorize a mix of new diagnostics", () => {
		const oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];
		const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [
			[vscode.Uri.file("/path/to/file1.ts"), [
				new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), "New fatal error", vscode.DiagnosticSeverity.Error, "typescript"),
				new vscode.Diagnostic(new vscode.Range(1, 0, 1, 10), "New linter warning", vscode.DiagnosticSeverity.Error, "eslint")
			]],
		];

		const { problems, warnings } = getNewDiagnostics(oldDiagnostics, newDiagnostics);
		expect(problems).toHaveLength(1);
		expect(warnings).toHaveLength(1);
		expect(problems[0][1][0].message).toBe("New fatal error");
		expect(warnings[0][1][0].message).toBe("New linter warning");
	});
});
