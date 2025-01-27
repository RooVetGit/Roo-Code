import { pipeline, FeatureExtractionPipeline } from "@huggingface/transformers"
import { EmbeddingModel, ModelConfig } from "./types"
import { Vector } from "../vector-store/types"
import { CodeDefinition } from "../types"

const MODEL_NAME = "sentence-transformers/all-MiniLM-L12-v2"

export class MiniLMModel implements EmbeddingModel {
	private pipe?: FeatureExtractionPipeline
	private initialized = false
	readonly dimension = 384 // MiniLM-L6 output dimension
	private initializationPromise: Promise<void> | null = null

	constructor(private config: ModelConfig) {}

	isInitialized(): boolean {
		return this.initialized
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			console.log("Service already initialized")
			return
		}

		if (this.initializationPromise) {
			console.log("Initialization already in progress, waiting...")
			await this.initializationPromise
			return
		}

		console.log("Starting service initialization")
		this.initializationPromise = (async () => {
			try {
				console.log("Creating pipeline...")
				this.pipe = await pipeline("feature-extraction", MODEL_NAME, {
					revision: "main",
					cache_dir: this.config.modelPath,
					device: "cpu",
				})
				console.log("Pipeline created successfully")

				// Set initialized flag before testing
				this.initialized = true

				console.log("Testing pipeline with sample text...")
				const testEmbedding = await this.embed("test")
				console.log("Test embedding generated successfully:", testEmbedding.values.length)

				console.log("Service initialization completed successfully")
			} catch (error) {
				console.error("Error during initialization:", error)
				this.initialized = false
				throw error
			} finally {
				this.initializationPromise = null
			}
		})()

		await this.initializationPromise
	}

	private normalizeVector(values: number[]): number[] {
		if (!this.config.normalize) return values
		const norm = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0))
		return norm > 0 ? values.map((v) => v / norm) : values
	}

	private computeAttentionWeights(values: number[], seqLen: number): number[] {
		const scores = new Array(seqLen).fill(0)
		const temperature = 10.0 // Higher temperature = sharper attention

		// Use [CLS] token (first token) as query vector
		const queryVector = values.slice(0, this.dimension)

		// Compute attention scores using scaled dot-product attention
		for (let i = 0; i < seqLen; i++) {
			let dotProduct = 0
			for (let j = 0; j < this.dimension; j++) {
				dotProduct += queryVector[j] * values[i * this.dimension + j]
			}
			// Scale dot products by sqrt(dim) as in transformer attention
			scores[i] = (dotProduct / Math.sqrt(this.dimension)) * temperature
		}

		// Apply softmax
		const maxScore = Math.max(...scores)
		const expScores = scores.map((s) => Math.exp(s - maxScore))
		const sumExp = expScores.reduce((a, b) => a + b, 0)
		return expScores.map((s) => s / sumExp)
	}

	private processOutput(output: { data: Float32Array | number[] | unknown }): number[] {
		// Ensure output.data is a Float32Array or number[]
		let values: number[]
		if (output.data instanceof Float32Array) {
			values = Array.from(output.data)
		} else if (Array.isArray(output.data)) {
			values = output.data.map((v) => Number(v))
		} else {
			values = Array.from(output.data as Iterable<number>).map((v) => Number(v))
		}

		const seqLen = values.length / this.dimension

		// Compute attention weights
		const attentionWeights = this.computeAttentionWeights(values, seqLen)

		// Apply attention-weighted pooling
		const result = new Array(this.dimension).fill(0)
		for (let i = 0; i < seqLen; i++) {
			const weight = attentionWeights[i]
			for (let j = 0; j < this.dimension; j++) {
				result[j] += values[i * this.dimension + j] * weight
			}
		}

		return this.normalizeVector(result)
	}

	private generateContextualText(definition: CodeDefinition): string {
		const parts: string[] = []

		// Add basic code info
		parts.push(`${definition.type} ${definition.name}`)

		// Add the actual code content
		parts.push(definition.content)

		return parts.join("\n")
	}

	async embed(text: string): Promise<Vector> {
		if (!this.initialized || !this.pipe) {
			throw new Error("Model not initialized")
		}

		try {
			const output = await this.pipe(text)
			return {
				values: this.processOutput(output),
				dimension: this.dimension,
			}
		} catch (error) {
			console.error("Failed to generate embedding:", error)
			throw error
		}
	}

	async embedBatch(texts: string[]): Promise<Vector[]> {
		if (!this.initialized || !this.pipe) {
			throw new Error("Model not initialized")
		}

		try {
			const outputs = await Promise.all(texts.map((text) => this.pipe!(text)))
			return outputs.map((output) => ({
				values: this.processOutput(output),
				dimension: this.dimension,
			}))
		} catch (error) {
			console.error("Failed to generate batch embeddings:", error)
			throw error
		}
	}

	async embedWithContext(definition: CodeDefinition): Promise<Vector> {
		const contextualText = this.generateContextualText(definition)
		return this.embed(contextualText)
	}

	async embedBatchWithContext(definitions: CodeDefinition[]): Promise<Vector[]> {
		const contextualTexts = definitions.map((def) => this.generateContextualText(def))
		return this.embedBatch(contextualTexts)
	}
}
