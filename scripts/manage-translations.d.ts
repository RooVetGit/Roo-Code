export function getNestedValue(obj: any, keyPath: string): any
export function setNestedValue(obj: any, keyPath: string, value: any): void
export function deleteNestedValue(obj: any, keyPath: string): boolean
export function collectStdin(): Promise<string>
export function parseInputLines(inputText: string): [string, string][] | [string][]
export function processStdin(): Promise<[string, string][]>
export function addTranslations(
	data: any,
	pairs: [string, string][],
	filePath: string,
	verbose?: boolean,
): Promise<boolean>
export function deleteTranslations(data: any, keys: string[], filePath: string, verbose?: boolean): Promise<boolean>
