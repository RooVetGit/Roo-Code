export default String.raw`
// MARK: - Class Definitions

// Testing class definition with inheritance and protocols
class TestBaseClass {
    func testBaseMethod() -> String {
        return "Base method"
    }
}

class TestClassDefinition: TestBaseClass, TestProtocolOne, TestProtocolTwo {
    // Testing property declarations with attributes
    @TestPropertyWrapper
    private var testPrivateProperty: String
    
    public let testConstantProperty: Int
    internal var testComputedProperty: Double {
        get { return Double(testPrivateProperty.count) }
        set { testPrivateProperty = String(newValue) }
    }
    
    // Testing initializer with parameters
    init(testParam1: String, testParam2: Int = 0) {
        self.testPrivateProperty = testParam1
        self.testConstantProperty = testParam2
        super.init()
    }
}

// MARK: - Protocol Definitions

// MARK: - Protocol Definitions

// Testing protocol with required property
protocol TestProtocolOne {
    var testRequiredProperty: String { get }
    func testProtocolOneMethod() -> String
}

// Testing protocol with required method
protocol TestProtocolTwo {
    func testRequiredMethod() -> Bool
    var testProtocolTwoProperty: Int { get }
}

// Testing protocol with associated type
protocol TestProtocolDefinition {
    associatedtype TestAssociatedType
    
    var testProtocolProperty: TestAssociatedType { get }
    
    func testProtocolMethod(
        _ testParam: TestAssociatedType
    ) -> Bool
    
    static func testStaticMethod()
}

// MARK: - Struct Definitions

// Testing struct with generic constraints
struct TestStructDefinition<T: Comparable> {
    // Testing property declarations
    private var testItems: [T]
    public let testIdentifier: String
    
    // Testing initializer with default values
    init(testItems: [T] = [], identifier: String = "default") {
        self.testItems = testItems
        self.testIdentifier = identifier
    }
    
    // Testing mutating method
    mutating func testAddItem(_ item: T) {
        testItems.append(item)
    }
}

// MARK: - Enum Definitions

// Testing enum with associated values
enum TestEnumDefinition<T> {
    case testSuccess(value: T)
    case testFailure(error: Error)
    
    // Testing computed property
    var testDescription: String {
        switch self {
        case .testSuccess(let value):
            return "Success: \\(value)"
        case .testFailure(let error):
            return "Failure: \\(error.localizedDescription)"
        }
    }
}

// MARK: - Extension Definitions

// Testing extension with generic constraints
extension TestClassDefinition where TestAssociatedType: Equatable {
    func testExtensionMethod<T: Comparable>(
        testParam: T
    ) -> [T] {
        return [testParam]
    }
}

// Testing extension adding functionality
extension TestStructDefinition {
    // Testing static method
    static func testFactoryMethod() -> Self {
        return Self()
    }
}

// MARK: - Property Wrapper

// Testing property wrapper with generic constraints
@propertyWrapper
struct TestPropertyWrapper<Value: Numeric & Comparable> {
    private var testStorage: Value
    private let testRange: ClosedRange<Value>
    
    var wrappedValue: Value {
        get { testStorage }
        set { testStorage = min(max(newValue, testRange.lowerBound), testRange.upperBound) }
    }
    
    init(wrappedValue: Value, range: ClosedRange<Value>) {
        self.testRange = range
        self.testStorage = min(max(wrappedValue, range.lowerBound), range.upperBound)
    }
}

// MARK: - Error Handling

// Testing error enum with associated values
enum TestError: Error {
    case testValidationError(message: String)
    case testNetworkError(code: Int)
}

// Testing throwing function
func testThrowingFunction(_ testParam: String) throws -> String {
    guard !testParam.isEmpty else {
        throw TestError.testValidationError(message: "Empty input")
    }
    return "Valid: \\(testParam)"
}

// MARK: - Conditional Compilation

// Testing conditional compilation blocks
#if os(iOS)
class TestPlatformClass {
    func testPlatformMethod() {
        print("iOS implementation")
    }
}
#elseif os(macOS)
class TestPlatformClass {
    func testPlatformMethod() {
        print("macOS implementation")
    }
}
#else
class TestPlatformClass {
    func testPlatformMethod() {
        print("Default implementation")
    }
}
#endif
`
