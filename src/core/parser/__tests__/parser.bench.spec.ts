import { describe, test } from "vitest"
import { PartialXMLStreamParser } from "../index"
import { performance } from "perf_hooks"

/**
 * Calculates statistical measures for a list of durations.
 */
function calculateStats(durations: number[]) {
	if (!durations || durations.length === 0) {
		return { min: 0, max: 0, median: 0, p95: 0, p99: 0, mean: 0, stdDev: 0 }
	}
	const sorted = [...durations].sort((a, b) => a - b)
	const N = sorted.length
	const mean = durations.reduce((a, b) => a + b, 0) / N

	const p95Index = Math.max(0, Math.min(N - 1, Math.floor(N * 0.95)))
	const p99Index = Math.max(0, Math.min(N - 1, Math.floor(N * 0.99)))
	const medianIndex = Math.max(0, Math.min(N - 1, Math.floor(N / 2)))

	return {
		min: sorted[0],
		max: sorted[N - 1],
		median: sorted[medianIndex],
		p95: sorted[p95Index],
		p99: sorted[p99Index],
		mean,
		stdDev: N > 0 ? Math.sqrt(durations.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / N) : 0,
	}
}

/**
 * Gets an appropriate iteration count for benchmarks based on input size.
 */
function getIterationCount(size: number) {
	if (size <= 10000) return 100 // ~10KB
	if (size <= 100000) return 20 // ~100KB
	if (size <= 500000) return 10 // ~500KB
	return 5 // For very large tests
}

/**
 * Runs a benchmark for a given operation and logs time and heap statistics.
 */
function runParserBenchmark(name: string, benchmarkFn: () => void, xmlInputString?: string) {
	const inputLength = xmlInputString ? xmlInputString.length : 1000
	const iterations = getIterationCount(inputLength)

	console.log(`\n--- Benchmark: ${name} (${iterations} iterations) ---`)

	// Warm-up
	try {
		benchmarkFn()
	} catch (e) {
		console.error(`Warm-up for "${name}" failed:`, e)
		return
	}

	if (global.gc) {
		global.gc()
	}
	const initialHeap = process.memoryUsage().heapUsed

	const durations: number[] = []
	for (let i = 0; i < iterations; i++) {
		try {
			const startTime = performance.now()
			benchmarkFn()
			const endTime = performance.now()
			durations.push(endTime - startTime)
		} catch (e) {
			console.error(`Iteration ${i + 1} for "${name}" failed:`, e)
			durations.push(NaN)
		}
	}

	const validDurations = durations.filter((d) => !isNaN(d))

	if (global.gc) {
		global.gc()
	}
	const finalHeap = process.memoryUsage().heapUsed

	if (validDurations.length === 0 && durations.length > 0) {
		console.log("  All iterations failed. No time statistics available.")
	} else if (validDurations.length < durations.length) {
		console.log(
			`  ${durations.length - validDurations.length} iterations failed. Statistics from ${validDurations.length} successful iterations:`,
		)
	}

	const stats = calculateStats(validDurations)
	const totalTime = validDurations.reduce((a, b) => a + b, 0)

	console.log("  Time Metrics:")
	console.log(`    Total: ${totalTime.toFixed(3)} ms (for ${validDurations.length} successful iterations)`)
	console.log(`    Mean:  ${stats.mean.toFixed(3)} ms`)
	console.log(
		`    Min:   ${stats.min.toFixed(3)} ms, Max: ${stats.max.toFixed(3)} ms, Median: ${stats.median.toFixed(3)} ms`,
	)
	console.log(
		`    P95:   ${stats.p95.toFixed(3)} ms, P99: ${stats.p99.toFixed(3)} ms, StdDev: ${stats.stdDev.toFixed(3)} ms`,
	)

	console.log("  Heap Metrics:")
	const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(3)
	console.log(`    Initial: ${toMB(initialHeap)} MB`)
	console.log(`    Final:   ${toMB(finalHeap)} MB`)
	console.log(`    Delta:   ${toMB(finalHeap - initialHeap)} MB`)
}

describe("PartialXMLStreamParser Benchmarks", () => {
	const simpleXML = '<root><item id="1">Text1</item><item id="2">Text2</item></root>'
	const complexXML = `
        <data store="main">
            <book category="COOKING">
                <title lang="en">Everyday Italian</title>
                <author>Giada De Laurentiis</author>
                <year>2005</year>
                <price>30.00</price>
            </book>
            <book category="CHILDREN">
                <title lang="en">Harry Potter</title>
                <author>J K. Rowling</author>
                <year>2005</year>
                <price>29.99</price>
            </book>
            <book category="WEB">
                <title lang="en">Learning XML</title>
                <author>Erik T. Ray</author>
                <year>2003</year>
                <price>39.95</price>
            </book>
            <misc type="info">Some additional info here</misc>
        </data>
    `
	const multiRootXML = "<item>A</item><item>B</item><item>C</item><item>D</item><item>E</item>"
	const cdataXML = "<root><data>This is some <CDATA> content with & symbols that should be preserved.</data></root>"
	const stopNodeXML =
		'<root><script type="text/javascript">function greet(){ console.log("hello <world>"); }</script><content>Parse me</content></root>'

	const generateLargeXML = (numItems: number) => {
		let xml = "<largeRoot>"
		for (let i = 0; i < numItems; i++) {
			xml += `<item id="${i}">`
			xml += `<name>Item Name ${i}</name>`
			xml += `<value>${Math.random() * 1000}</value>`
			xml += `<description>This is a description for item ${i}. It contains some text to make it a bit larger.</description>`
			xml += `<nested><subitem attr="sub${i}">Sub Value ${i}</subitem></nested>`
			xml += "</item>"
		}
		xml += "</largeRoot>"
		return xml
	}

	const largeXMLString = generateLargeXML(1000) // 1000 items

	test("Parse simple XML (single chunk)", () => {
		runParserBenchmark(
			"Parse simple XML (single chunk)",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(simpleXML)
				parser.parseStream(null)
			},
			simpleXML,
		)
	})

	test("Parse complex XML (single chunk)", () => {
		runParserBenchmark(
			"Parse complex XML (single chunk)",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(complexXML)
				parser.parseStream(null)
			},
			complexXML,
		)
	})

	test("Parse simple XML (multiple chunks)", () => {
		runParserBenchmark(
			"Parse simple XML (multiple chunks)",
			() => {
				const parser = new PartialXMLStreamParser()
				const chunks = simpleXML.match(/.{1,10}/g) || [simpleXML]
				chunks.forEach((chunk) => parser.parseStream(chunk))
				parser.parseStream(null)
			},
			simpleXML,
		)
	})

	test("Parse complex XML (multiple chunks)", () => {
		runParserBenchmark(
			"Parse complex XML (multiple chunks)",
			() => {
				const parser = new PartialXMLStreamParser()
				const chunks = complexXML.match(/.{1,50}/g) || [complexXML]
				chunks.forEach((chunk) => parser.parseStream(chunk))
				parser.parseStream(null)
			},
			complexXML,
		)
	})

	test("Parse XML with multiple root elements", () => {
		runParserBenchmark(
			"Parse XML with multiple root elements",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(multiRootXML)
				parser.parseStream(null)
			},
			multiRootXML,
		)
	})

	test("Parse XML with CDATA", () => {
		runParserBenchmark(
			"Parse XML with CDATA",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(cdataXML)
				parser.parseStream(null)
			},
			cdataXML,
		)
	})

	test("Parse XML with stop nodes", () => {
		runParserBenchmark(
			"Parse XML with stop nodes",
			() => {
				const parser = new PartialXMLStreamParser({ stopNodes: ["script"] })
				parser.parseStream(stopNodeXML)
				parser.parseStream(null)
			},
			stopNodeXML,
		)
	})

	test("Parse XML with alwaysCreateTextNode true", () => {
		runParserBenchmark(
			"Parse XML with alwaysCreateTextNode true",
			() => {
				const parser = new PartialXMLStreamParser({
					alwaysCreateTextNode: true,
				})
				parser.parseStream(complexXML)
				parser.parseStream(null)
			},
			complexXML,
		)
	})

	test("Parse XML with parsePrimitives true", () => {
		runParserBenchmark(
			"Parse XML with parsePrimitives true",
			() => {
				const parser = new PartialXMLStreamParser({ parsePrimitives: true })
				parser.parseStream(complexXML)
				parser.parseStream(null)
			},
			complexXML,
		)
	})

	test("Parse large XML (1000 items, single chunk)", () => {
		runParserBenchmark(
			"Parse large XML (1000 items, single chunk)",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(largeXMLString)
				parser.parseStream(null)
			},
			largeXMLString,
		)
	})

	test("Parse large XML (1000 items, multiple chunks)", () => {
		runParserBenchmark(
			"Parse large XML (1000 items, multiple chunks)",
			() => {
				const parser = new PartialXMLStreamParser()
				const chunks = largeXMLString.match(/.{1,1024}/g) || [largeXMLString]
				chunks.forEach((chunk) => parser.parseStream(chunk))
				parser.parseStream(null)
			},
			largeXMLString,
		)
	})

	test("Parse very large XML (5000 items, single chunk)", () => {
		const veryLargeXMLString = generateLargeXML(5000)
		runParserBenchmark(
			"Parse very large XML (5000 items, single chunk)",
			() => {
				const parser = new PartialXMLStreamParser()
				parser.parseStream(veryLargeXMLString)
				parser.parseStream(null)
			},
			veryLargeXMLString,
		)
	})

	test("Parse very large XML (5000 items, multiple chunks)", () => {
		const veryLargeXMLString = generateLargeXML(5000)
		runParserBenchmark(
			"Parse very large XML (5000 items, multiple chunks)",
			() => {
				const parser = new PartialXMLStreamParser()
				const chunks = veryLargeXMLString.match(/.{1,1024}/g) || [veryLargeXMLString]
				chunks.forEach((chunk) => parser.parseStream(chunk))
				parser.parseStream(null)
			},
			veryLargeXMLString,
		)
	})
})
