export default String.raw`
// MARK: - Class Definitions

// Class declaration for testing class capture
class TestClassDefinition {
    // Properties for testing property capture
    var testProperty: String
    var testAnotherProperty: Int
    private var testPrivateProperty: String
    
    // Static property
    static let testStaticProperty = "Static Value"
    
    // Method for testing method capture
    func testMethod() -> String {
        return "This is a test method"
    }
    
    // Method with parameters
    func testMethodWithParams(param1: String, param2: Int) -> String {
        return "Method with params: \\(param1), \\(param2)"
    }
    
    // Initializer for testing initializer capture
    init(property1: String, property2: Int, property3: String) {
        self.testProperty = property1
        self.testAnotherProperty = property2
        self.testPrivateProperty = property3
    }
    
    // Deinitializer for testing deinitializer capture
    deinit {
        print("TestClassDefinition is being deinitialized")
    }
    
    // Nested type
    struct TestNestedStruct {
        var nestedProperty1: Double
        var nestedProperty2: String
    }
}

// MARK: - Struct Definitions

// Struct declaration for testing struct capture
struct TestStructDefinition {
    // Properties
    var testStructProperty1: Double
    var testStructProperty2: Double
    
    // Initializer
    init(prop1: Double, prop2: Double) {
        self.testStructProperty1 = prop1
        self.testStructProperty2 = prop2
    }
    
    // Mutating method
    mutating func testMutatingMethod(value1: Double, value2: Double) {
        testStructProperty1 += value1
        testStructProperty2 += value2
    }
}

// MARK: - Enum Definitions

// Enum declaration for testing enum capture
enum TestEnumDefinition {
    case testCase1
    case testCase2
    case testCase3
    case testCase4
    
    // Method in enum
    func testEnumMethod() -> String {
        switch self {
        case .testCase1:
            return "Test Case 1"
        case .testCase2:
            return "Test Case 2"
        case .testCase3:
            return "Test Case 3"
        case .testCase4:
            return "Test Case 4"
        }
    }
}

// Enum with associated values for testing generic enum capture
enum TestGenericEnum<Success, Failure> where Failure: Error {
    case testSuccess(Success)
    case testFailure(Failure)
    
    // Method with switch
    func testHandleMethod(onSuccess: (Success) -> Void, onFailure: (Failure) -> Void) {
        switch self {
        case .testSuccess(let value):
            onSuccess(value)
        case .testFailure(let error):
            onFailure(error)
        }
    }
}

// MARK: - Protocol Definitions

// Protocol declaration for testing protocol capture
protocol TestProtocolDefinition {
    // Protocol property requirement
    var testProtocolProperty: String { get }
    
    // Protocol method requirement
    func testProtocolMethod() -> String
    
    // Protocol initializer requirement
    init(identifier: String)
}

// Protocol with associated type
protocol TestGenericProtocol {
    associatedtype TestItem
    
    // Protocol methods with associated type
    mutating func testAddMethod(item: TestItem)
    var testCountProperty: Int { get }
}

// MARK: - Extension Definitions

// Extension for testing extension capture
extension TestStructDefinition: TestProtocolDefinition {
    // Protocol conformance
    var testProtocolProperty: String {
        return "Test Protocol Property Implementation"
    }
    
    func testProtocolMethod() -> String {
        return "Test Protocol Method Implementation"
    }
    
    init(identifier: String) {
        let components = identifier.split(separator: ",")
        self.init(
            prop1: Double(components[0]) ?? 0,
            prop2: Double(components[1]) ?? 0
        )
    }
}

// Extension adding functionality to standard type
extension String {
    // Extension method
    func testExtensionMethod() -> String {
        return self + " - Extended"
    }
    
    // Extension computed property
    var testExtensionProperty: Bool {
        let pattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}"
        return range(of: pattern, options: .regularExpression) != nil
    }
}

// MARK: - Generic Definitions

// Generic struct for testing generic type capture
struct TestGenericStruct<T> {
    // Generic property
    var testGenericItems: [T] = []
    
    // Generic method
    mutating func testGenericMethod(item: T) {
        testGenericItems.append(item)
    }
    
    // Subscript
    subscript(index: Int) -> T {
        return testGenericItems[index]
    }
}

// MARK: - Type Aliases

// Type alias for testing type alias capture
typealias TestTypeAlias = [String: String]
typealias TestGenericTypeAlias<T> = (T) -> T

// MARK: - Function Definitions

// Function with parameters for testing function capture
func testStandaloneFunction(param1: Int, param2: String) -> String {
    return "Function with params: \\(param1), \\(param2)"
}

// Function with inout parameter
func testInoutFunction<T>(_ a: inout T, _ b: inout T) {
    let temp = a
    a = b
    b = temp
}

// MARK: - Property Wrapper

// Property wrapper for testing property wrapper capture
@propertyWrapper
struct TestPropertyWrapper<Value: Comparable> {
    private var value: Value
    private let range: ClosedRange<Value>
    
    init(wrappedValue: Value, range: ClosedRange<Value>) {
        self.range = range
        self.value = min(max(wrappedValue, range.lowerBound), range.upperBound)
    }
    
    var wrappedValue: Value {
        get { value }
        set { value = min(max(newValue, range.lowerBound), range.upperBound) }
    }
}

// Class using property wrapper
class TestPropertyWrapperUser {
    @TestPropertyWrapper(wrappedValue: 25, range: 0...100)
    var testWrappedProperty: Double
}

// MARK: - Error Handling

// Error enum for testing error enum capture
enum TestErrorEnum: Error {
    case testErrorCase1
    case testErrorCase2(code: Int)
    case testErrorCase3
    
    // Computed property on enum
    var testErrorDescription: String {
        switch self {
        case .testErrorCase1:
            return "Test Error Case 1"
        case .testErrorCase2(let code):
            return "Test Error Case 2 with code: \\(code)"
        case .testErrorCase3:
            return "Test Error Case 3"
        }
    }
}

// Function with error handling
func testErrorFunction(param: String) throws -> String {
    guard !param.isEmpty else {
        throw TestErrorEnum.testErrorCase1
    }
    
    if param == "error" {
        throw TestErrorEnum.testErrorCase2(code: 500)
    }
    
    return "Success: \\(param)"
}

// MARK: - Conditional Compilation

// Conditional compilation for testing conditional classes
#if os(iOS)
class TestiOSClass {
    func testMethod() {
        print("iOS specific implementation")
    }
}
#elseif os(macOS)
class TestMacOSClass {
    func testMethod() {
        print("macOS specific implementation")
    }
}
#else
class TestGenericClass {
    func testMethod() {
        print("Generic implementation")
    }
}
#endif
`
