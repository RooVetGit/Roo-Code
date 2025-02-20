import { getEncoding } from "js-tiktoken"

interface TextSplitterParams {
	chunkSize: number
	chunkOverlap: number
}

abstract class TextSplitter implements TextSplitterParams {
	chunkSize = 1000
	chunkOverlap = 200

	constructor(fields?: Partial<TextSplitterParams>) {
		this.chunkSize = fields?.chunkSize ?? this.chunkSize
		this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap
		if (this.chunkOverlap >= this.chunkSize) {
			throw new Error("Cannot have chunkOverlap >= chunkSize")
		}
	}

	abstract splitText(text: string): string[]

	createDocuments(texts: string[]): string[] {
		const documents: string[] = []
		for (let i = 0; i < texts.length; i += 1) {
			const text = texts[i]
			for (const chunk of this.splitText(text!)) {
				documents.push(chunk)
			}
		}
		return documents
	}

	splitDocuments(documents: string[]): string[] {
		return this.createDocuments(documents)
	}

	private joinDocs(docs: string[], separator: string): string | null {
		const text = docs.join(separator).trim()
		return text === "" ? null : text
	}

	mergeSplits(splits: string[], separator: string): string[] {
		const docs: string[] = []
		const currentDoc: string[] = []
		let total = 0
		for (const d of splits) {
			const _len = d.length
			if (total + _len >= this.chunkSize) {
				if (total > this.chunkSize) {
					console.warn(
						`Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`,
					)
				}
				if (currentDoc.length > 0) {
					const doc = this.joinDocs(currentDoc, separator)
					if (doc !== null) {
						docs.push(doc)
					}
					// Keep on popping if:
					// - we have a larger chunk than in the chunk overlap
					// - or if we still have any chunks and the length is long
					while (total > this.chunkOverlap || (total + _len > this.chunkSize && total > 0)) {
						total -= currentDoc[0]!.length
						currentDoc.shift()
					}
				}
			}
			currentDoc.push(d)
			total += _len
		}
		const doc = this.joinDocs(currentDoc, separator)
		if (doc !== null) {
			docs.push(doc)
		}
		return docs
	}
}

export interface RecursiveCharacterTextSplitterParams extends TextSplitterParams {
	separators: string[]
}

export class RecursiveCharacterTextSplitter extends TextSplitter implements RecursiveCharacterTextSplitterParams {
	separators: string[] = ["\n\n", "\n", ".", ",", ">", "<", " ", ""]

	constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
		super(fields)
		this.separators = fields?.separators ?? this.separators
	}

	splitText(text: string): string[] {
		const finalChunks: string[] = []

		// Get appropriate separator to use.
		let separator: string = this.separators[this.separators.length - 1]!

		for (const s of this.separators) {
			if (s === "") {
				separator = s
				break
			}

			if (text.includes(s)) {
				separator = s
				break
			}
		}

		// Now that we have the separator, split the text
		const splits = separator ? text.split(separator) : text.split("")

		// Now go merging things, recursively splitting longer texts.
		let goodSplits: string[] = []

		for (const s of splits) {
			if (s.length < this.chunkSize) {
				goodSplits.push(s)
			} else {
				if (goodSplits.length) {
					const mergedText = this.mergeSplits(goodSplits, separator)
					finalChunks.push(...mergedText)
					goodSplits = []
				}

				const otherInfo = this.splitText(s)
				finalChunks.push(...otherInfo)
			}
		}

		if (goodSplits.length) {
			const mergedText = this.mergeSplits(goodSplits, separator)
			finalChunks.push(...mergedText)
		}

		return finalChunks
	}
}

export const encoder = getEncoding("o200k_base")
