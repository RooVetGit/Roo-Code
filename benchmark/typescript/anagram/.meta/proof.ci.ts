function sort(input: string): string {
	return input.toString().toLowerCase().split("").sort().join("")
}

export class Anagram {
	private value: string
	constructor(input: string) {
		this.value = input
	}

	public matches(...input: string[]): string[] {
		const result: string[] = []
		for (const each of input) {
			if (sort(each) === sort(this.value)) {
				if (each.toLowerCase() === this.value.toLowerCase()) {
					continue
				}
				result.push(each)
			}
		}
		return result
	}
}
