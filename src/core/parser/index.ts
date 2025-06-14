import { initializeParserOptions, resetParserState } from "./parser-setup"
import { processXmlChunk, finalizeStreamResult } from "./stream-processor"
import { coreProcessBuffer } from "./core-parser"
import { xmlObjectToString } from "./utils"
import { ParserContext, ParserOptions, ParseResult } from "./types"

export class PartialXMLStreamParser implements ParserContext {
	// Required ParserContext properties
	customOptions!: Required<ParserOptions>
	allowedRootNodes!: Set<string> | null
	attrRegex!: RegExp
	commentRegex!: RegExp
	cdataOpenRegex!: RegExp
	doctypeRegex!: RegExp
	xmlDeclRegex!: RegExp
	stopNodeRegexCache!: Record<string, RegExp>
	simpleStopNodes!: Set<string>
	pathStopNodes!: Set<string>
	streamingBuffer!: string
	_activelyStreaming!: boolean
	accumulator!: any[]
	currentPointer!: any
	tagStack!: any[]
	parsingIndex!: number
	incompleteStructureState!: any
	reparsedSegmentContext!: any
	streamingBufferBeforeClear!: string
	_originalBufferHadContent!: boolean
	_lastClearedIncompleteStateWasSpecial!: boolean
	_rootDeterminationBuffer!: string
	_plainTextAccumulator!: string
	_treatAsPlainText!: boolean
	_initialSegmentTypeDecided!: boolean

	constructor(options?: Partial<ParserOptions>) {
		initializeParserOptions(this, options)
		this.reset()
	}

	reset(): void {
		resetParserState(this)
	}

	private _processBuffer(): void {
		coreProcessBuffer(this)
	}

	parseStream(xmlChunk: string | Buffer | null | undefined): ParseResult {
		const chunkProcessingResult = processXmlChunk(this, xmlChunk)

		if (chunkProcessingResult.earlyExitResult) {
			return chunkProcessingResult.earlyExitResult
		}

		// Only call _processBuffer if the chunk processor determined it's necessary
		// and there's actually something in the streamingBuffer to process,
		// or if there's an incomplete state that needs resolving even with an empty new chunk.
		if (
			chunkProcessingResult.shouldProcessBuffer &&
			(this.streamingBuffer.length > 0 || this.incompleteStructureState)
		) {
			this._processBuffer()
		} else if (chunkProcessingResult.shouldProcessBuffer && xmlChunk === null && this.incompleteStructureState) {
			// Special case for EOF with only incomplete state and empty buffer.
			this._processBuffer()
		}

		return finalizeStreamResult(this, xmlChunk)
	}
}

export { xmlObjectToString }
export type { ParserOptions, ParseResult }
