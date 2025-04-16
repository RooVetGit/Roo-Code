export class XmlMatcher {
	tagName
	transform
	position
	index = 0
	chunks = []
	cached = []
	matched = false
	state = "TEXT"
	depth = 0
	pointer = 0
	constructor(tagName, transform, position = 0) {
		this.tagName = tagName
		this.transform = transform
		this.position = position
	}
	collect() {
		if (!this.cached.length) {
			return
		}
		const last = this.chunks.at(-1)
		const data = this.cached.join("")
		const matched = this.matched
		if (last?.matched === matched) {
			last.data += data
		} else {
			this.chunks.push({
				data,
				matched,
			})
		}
		this.cached = []
	}
	pop() {
		const chunks = this.chunks
		this.chunks = []
		if (!this.transform) {
			return chunks
		}
		return chunks.map(this.transform)
	}
	_update(chunk) {
		for (let i = 0; i < chunk.length; i++) {
			const char = chunk[i]
			this.cached.push(char)
			this.pointer++
			if (this.state === "TEXT") {
				if (char === "<" && (this.pointer <= this.position + 1 || this.matched)) {
					this.state = "TAG_OPEN"
					this.index = 0
				} else {
					this.collect()
				}
			} else if (this.state === "TAG_OPEN") {
				if (char === ">" && this.index === this.tagName.length) {
					this.state = "TEXT"
					if (!this.matched) {
						this.cached = []
					}
					this.depth++
					this.matched = true
				} else if (this.index === 0 && char === "/") {
					this.state = "TAG_CLOSE"
				} else if (char === " " && (this.index === 0 || this.index === this.tagName.length)) {
					continue
				} else if (this.tagName[this.index] === char) {
					this.index++
				} else {
					this.state = "TEXT"
					this.collect()
				}
			} else if (this.state === "TAG_CLOSE") {
				if (char === ">" && this.index === this.tagName.length) {
					this.state = "TEXT"
					this.depth--
					this.matched = this.depth > 0
					if (!this.matched) {
						this.cached = []
					}
				} else if (char === " " && (this.index === 0 || this.index === this.tagName.length)) {
					continue
				} else if (this.tagName[this.index] === char) {
					this.index++
				} else {
					this.state = "TEXT"
					this.collect()
				}
			}
		}
	}
	final(chunk) {
		if (chunk) {
			this._update(chunk)
		}
		this.collect()
		return this.pop()
	}
	update(chunk) {
		this._update(chunk)
		return this.pop()
	}
}
//# sourceMappingURL=xml-matcher.js.map
