
var ff = class {
	constructor(t, r, n, i) {
		this.completionText = t
		this.suffixReplacementText = r
		this.skippedSuffix = n
		this.range = i
	}
	toString() {
		return `text: ${this.completionText}
    suffixReplacementText: ${this.suffixReplacementText}
    skippedSuffix: ${this.skippedSuffix}
    start: ${this.range.startOffset}
    end: ${this.range.endOffset}`
	}
}