import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { kotlinQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"

// Sample Kotlin content for tests covering all supported structures
const sampleKotlinContent = `
// Package declaration
package com.example.kotlin

// Import statements
import kotlin.collections.List
import kotlin.math.PI
import kotlin.math.sqrt

// Regular class declaration
class TestClassDefinition {
    // Properties
    var testProperty: String = ""
    var age: Int = 0
    
    // Constructor
    constructor(name: String, age: Int) {
        this.testProperty = name
        this.age = age
    }
    
    // Method
    fun greet(): String {
        return "Hello, my name is $testProperty and I am $age years old."
    }
}

// Another regular class with primary constructor
class TestClassWithConstructor(
    val name: String,
    val position: String,
    var salary: Double
) {
    // Secondary constructor
    constructor(name: String, position: String) : this(name, position, 0.0)
    
    // Method with default parameter
    fun giveRaise(amount: Double = 100.0) {
        salary += amount
    }
}

// Data class declaration
data class TestDataClass(
    val id: String,
    val name: String,
    val price: Double,
    val category: String
) {
    // Method in data class
    fun applyDiscount(percentage: Double): Double {
        return price * (1 - percentage / 100)
    }
}

// Enum class declaration
enum class TestEnumClass(val shortName: String) {
    MONDAY("Mon"),
    TUESDAY("Tue"),
    WEDNESDAY("Wed"),
    THURSDAY("Thu"),
    FRIDAY("Fri"),
    SATURDAY("Sat"),
    SUNDAY("Sun");
    
    // Method in enum class
    fun isWeekend(): Boolean {
        return this == SATURDAY || this == SUNDAY
    }
}

// Interface declaration
interface TestInterface {
    // Abstract property
    val area: Double
    
    // Abstract method
    fun draw()
    
    // Method with default implementation
    fun erase() {
        println("Erasing the drawing")
    }
}

// Abstract class declaration
abstract class TestAbstractClass : TestInterface {
    // Abstract property
    abstract val name: String
    
    // Concrete property
    val color: String = "White"
    
    // Abstract method
    abstract fun calculateArea(): Double
    
    // Concrete method
    override fun draw() {
        println("Drawing a $color $name")
    }
}

// Sealed class declaration
sealed class TestSealedClass {
    // Nested data class
    data class TestNestedDataClass(val data: Any) : TestSealedClass()
    
    // Nested class
    class TestNestedClass(val exception: Exception) : TestSealedClass()
    
    // Nested object
    object TestNestedObject : TestSealedClass()
}

// Object declaration (singleton)
object TestObject {
    private var connection: String? = null
    
    fun connect(url: String) {
        connection = url
        println("Connected to $url")
    }
    
    fun disconnect() {
        connection = null
        println("Disconnected")
    }
}

// Class with companion object
class TestCompanionObjectClass {
    companion object {
        // Constant
        const val PI_VALUE = 3.14159
        
        // Static method
        fun square(x: Double): Double {
            return x * x
        }
    }
}

// Regular function declaration
fun testFunction(x1: Double, y1: Double, x2: Double, y2: Double): Double {
    val dx = x2 - x1
    val dy = y2 - y1
    return sqrt(dx * dx + dy * dy)
}

// Extension function declaration
fun String.testExtensionFunction(): Int {
    return count { it in "aeiouAEIOU" }
}

// Extension property declaration
val String.testExtensionProperty: Int
    get() = count { it in "aeiouAEIOU" }

// Property declaration
val testProperty = "1.0.0"

// Type alias declaration
typealias TestTypeAlias = Map<String, TestUser>

// Class with generics
class TestGenericClass<T>(var content: T) {
    fun getContent(): T {
        return content
    }
}

// Value class declaration
@JvmInline
value class TestValueClass(private val value: String)

// Annotation class declaration
annotation class TestAnnotationClass(
    val message: String,
    val replaceWith: String = ""
)

// Higher-order function declaration
fun testHigherOrderFunction(x: Int, y: Int, operation: (Int, Int) -> Int): Int {
    return operation(x, y)
}

// Suspend function declaration
suspend fun testSuspendFunction(url: String): String {
    // Simulating network call
    return "Data from $url"
}

// Class for testing nested classes
class TestOuterClass {
    private val outerProperty = "Outer"
    
    // Nested class
    class TestNestedClass {
        val nestedProperty = "Nested"
    }
}

// Function with infix notation
infix fun Int.testInfixFunction(exponent: Int): Int {
    return Math.pow(this.toDouble(), exponent.toDouble()).toInt()
}

// Function with tailrec for tail recursion optimization
tailrec fun testTailrecFunction(n: Int, accumulator: Int = 1): Int {
    return if (n <= 1) accumulator else testTailrecFunction(n - 1, n * accumulator)
}

// Inline function with reified type parameters
inline fun <reified T> testReifiedFunction(value: Any): Boolean {
    return value is T
}

// Class for testing
class TestUser(val id: String, val name: String, val email: String)
`

// Kotlin test options
const kotlinOptions = {
	language: "kotlin",
	wasmFile: "tree-sitter-kotlin.wasm",
	queryString: kotlinQuery,
	extKey: "kt",
}

// Mock file system operations
jest.mock("fs/promises")
const mockedFs = jest.mocked(fs)

// Mock loadRequiredLanguageParsers
jest.mock("../languageParser", () => ({
	loadRequiredLanguageParsers: jest.fn(),
}))

// Mock fileExistsAtPath to return true for our test paths
jest.mock("../../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation(() => Promise.resolve(true)),
}))

describe("parseSourceCodeDefinitionsForFile with Kotlin", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should debug Kotlin tree structure", async () => {
		if (process.env.DEBUG) {
			await inspectTreeStructure(sampleKotlinContent, "kotlin")
		}
		expect(true).toBe(true) // Dummy assertion
	})

	it("should parse Kotlin class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for class declarations
		expect(result).toContain("class TestClassDefinition")
		expect(result).toContain("class TestClassWithConstructor")
		// TestUser is not captured by the parser
	})

	it("should parse Kotlin data class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for data class declarations
		expect(result).toContain("data class TestDataClass")
		// Nested data classes are not captured by the parser
	})

	it("should parse Kotlin interface declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for interface declarations
		expect(result).toContain("interface TestInterface")
	})

	it("should parse Kotlin enum class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for enum class declarations
		expect(result).toContain("enum class TestEnumClass")
	})

	it("should parse Kotlin abstract class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for abstract class declarations
		expect(result).toContain("abstract class TestAbstractClass")
	})

	it("should parse Kotlin sealed class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for sealed class declarations
		expect(result).toContain("sealed class TestSealedClass")
	})

	it("should parse Kotlin object declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for object declarations
		expect(result).toContain("object TestObject")
		// Nested objects are not captured by the parser
	})

	it("should parse Kotlin companion object declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for companion object declarations in TestCompanionObjectClass
		expect(result).toContain("companion object")
	})

	it("should parse Kotlin function declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for function declarations
		expect(result).toContain("fun testFunction")
	})

	it("should parse Kotlin generic class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for generic class declarations
		expect(result).toContain("class TestGenericClass")
	})

	it("should parse Kotlin annotation class declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for annotation class declarations
		expect(result).toContain("annotation class TestAnnotationClass")
	})

	it("should parse Kotlin suspend functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.kt", sampleKotlinContent, kotlinOptions)

		// Check for suspend functions
		expect(result).toContain("suspend fun testSuspendFunction")
	})
})
