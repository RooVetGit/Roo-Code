// Type definitions for the XML parser

export interface ParserOptions {
	textNodeName?: string
	attributeNamePrefix?: string
	stopNodes?: string | string[]
	maxDepth?: number | null
	alwaysCreateTextNode?: boolean
	parsePrimitives?: boolean
	allowedRootNodes?: string | string[] | null
	ignoreWhitespace?: boolean
}

export interface ParserContext {
	customOptions: Required<ParserOptions>
	allowedRootNodes: Set<string> | null
	attrRegex: RegExp
	commentRegex: RegExp
	cdataOpenRegex: RegExp
	doctypeRegex: RegExp
	xmlDeclRegex: RegExp
	stopNodeRegexCache: Record<string, RegExp>
	simpleStopNodes: Set<string>
	pathStopNodes: Set<string>
	streamingBuffer: string
	_activelyStreaming: boolean
	accumulator: any[]
	currentPointer: any
	tagStack: TagState[]
	parsingIndex: number
	incompleteStructureState: IncompleteState | null
	reparsedSegmentContext: ReparsedSegmentContext | null
	streamingBufferBeforeClear: string
	_originalBufferHadContent: boolean
	_lastClearedIncompleteStateWasSpecial: boolean
	_rootDeterminationBuffer: string
	_plainTextAccumulator: string
	_treatAsPlainText: boolean
	_initialSegmentTypeDecided: boolean
}

export interface TagState {
	tagName: string
	objPtr: any
	path: string
	textOnly: boolean
}

export interface IncompleteState {
	type: string
	at?: number
	partial?: string
	lookingFor?: string
	partialData?: string
	parentOfPartial?: any
	processedPartialForCleanup?: any
	tagName?: string
	depth?: number
	contentStartIndex?: number
	stopNodeObjectRef?: any
}

export interface ReparsedSegmentContext {
	partialText?: string
	parentContext?: any
	originalIndex?: number
	tagType?: string
}

export interface ParseResult {
	metadata: {
		partial: boolean
	}
	xml: any[]
}

export interface ChunkProcessingResult {
	shouldProcessBuffer: boolean
	earlyExitResult?: ParseResult | null
}

export interface TagHandlerResult {
	processed: boolean
	shouldReturn: boolean
}

export interface SpecialPrefixResult {
	matched: boolean
	shouldReturn: boolean
	shouldContinue: boolean
}

export interface StateHandlerResult {
	shouldReturn: boolean
}
