export default String.raw`
// Package and imports
package com.example.test
import kotlin.math.sqrt

// Testing regular class with properties and methods
class TestBasicClass {
    private var name: String = ""
    protected var count: Int = 0
    
    constructor(name: String, count: Int) {
        this.name = name
        this.count = count
    }
    
    fun testMethod(): String {
        return "Test $name with count $count"
    }
}

// Testing data class with properties
data class TestDataClass(
    val testProperty1: String,
    var testProperty2: Int,
    private val testProperty3: Boolean = false,
    internal var testProperty4: Float? = null
)

// Testing function with type parameters
fun <T : Any> testGenericFunction(
    param1: T,
    param2: List<T>,
    param3: (T) -> Boolean = { true }
): Map<String, T> {
    return mapOf()
}

// Testing class with companion object
class TestCompanionClass {
    companion object TestCompanion {
        const val TEST_CONSTANT = "test"
        fun testCompanionMethod() = TEST_CONSTANT
        val testCompanionProperty = "property"
        var testMutableProperty = 0
    }
}

// Testing interface with properties and methods
interface TestInterface {
    val testProperty: String
    fun testAbstractMethod()
    fun testDefaultMethod() {
        println("Default implementation")
    }
}

// Testing abstract class implementation
abstract class TestAbstractClass : TestInterface {
    abstract val testAbstractProperty: Int
    protected val testProtectedProperty: String = ""
    
    abstract fun testAbstractClassMethod(): Double
    override fun testAbstractMethod() {
        println("Abstract class implementation")
    }
}

// Testing enum class with properties
enum class TestEnumClass(val testValue: String) {
    TEST_ONE("one"),
    TEST_TWO("two"),
    TEST_THREE("three");
    
    fun testEnumMethod(): Boolean {
        return testValue.length > 3
    }
}

// Testing sealed class hierarchy
sealed class TestSealedClass {
    data class TestSealedData(val testData: String) : TestSealedClass()
    class TestSealedSubclass(val testValue: Int) : TestSealedClass()
    object TestSealedObject : TestSealedClass()
}

// Testing object declaration (singleton)
object TestSingleton {
    private var testState: String? = null
    
    fun testSingletonMethod(value: String) {
        testState = value
    }
    
    fun testStateCheck(): Boolean {
        return !testState.isNullOrEmpty()
    }
}

// Testing annotation class
annotation class TestAnnotation(
    val testMessage: String,
    val testPriority: Int = 0
)

// Testing generic class
class TestGenericClass<T>(
    private val testContent: T,
    private val testHandler: (T) -> String
) {
    fun testGenericMethod(): String {
        return testHandler(testContent)
    }
}

// Testing suspend function
suspend fun testSuspendFunction(
    testParam1: String,
    testParam2: Int = 0
): Result<String> {
    return Result.success("Test $testParam1 with $testParam2")
}`
