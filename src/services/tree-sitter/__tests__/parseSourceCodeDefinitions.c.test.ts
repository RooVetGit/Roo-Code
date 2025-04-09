import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { cQuery } from "../queries"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"

// Sample C content for tests covering all supported structures:
// - function definitions
// - struct definitions
// - union definitions
// - enum definitions
// - typedef declarations
// - macro definitions
// - global variables
// - static variables and functions
// - extern declarations
// - function pointers
// - array declarations
// - pointer declarations
// - preprocessor directives
// - inline functions
// - variadic functions
// - bit fields
// - compound literals
// - designated initializers
const sampleCContent = `
// ===== FUNCTION DEFINITIONS =====

// Basic function definition
int test_function_definition(int a, int b) {
    int result = a + b;
    return result;
}

// Function with multiple parameters
float test_function_with_params(int count, float *values) {
    float sum = 0.0f;
    int i;
    
    for (i = 0; i < count; i++) {
        sum += values[i];
    }
    
    return sum / count;
}

// Function with pointer parameters
void test_function_with_pointers(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

// Function with array parameter
void test_function_with_array(int arr[], int size) {
    for (int i = 0; i < size; i++) {
        arr[i] = arr[i] * 2;
    }
}

// Variadic function
#include <stdarg.h>
int test_variadic_function(int count, ...) {
    va_list args;
    va_start(args, count);
    
    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += va_arg(args, int);
    }
    
    va_end(args);
    return sum;
}

// Inline function
inline int test_inline_function(int a, int b) {
    return (a < b) ? a : b;
}

// ===== STRUCT DEFINITIONS =====

// Basic struct definition
struct test_struct_definition {
    int x;
    int y;
    int z;
    char name[20];
};

// Nested struct
struct test_nested_struct {
    char name[50];
    int age;
    struct test_nested_struct_address {
        char street[100];
        char city[50];
        char state[20];
        int zip;
    } address;
};

// Struct with bit fields
struct test_struct_with_bitfields {
    unsigned int flag1 : 1;
    unsigned int flag2 : 1;
    unsigned int value : 6;
    unsigned int reserved : 24;
};

// Struct with function pointer member
struct test_struct_with_function_ptr {
    void (*on_event)(const char*);
    int priority;
    char name[32];
    int id;
};

// ===== UNION DEFINITIONS =====

// Basic union definition
union test_union_definition {
    int i;
    float f;
    char str[20];
    void *ptr;
};

// ===== ENUM DEFINITIONS =====

// Basic enum definition
enum test_enum_definition {
    TEST_ENUM_RED,
    TEST_ENUM_GREEN,
    TEST_ENUM_BLUE,
    TEST_ENUM_YELLOW,
    TEST_ENUM_PURPLE
};

// ===== TYPEDEF DECLARATIONS =====

// Typedef for primitive type
typedef unsigned int test_typedef_primitive;

// Typedef for struct
typedef struct {
    double x;
    double y;
    double z;
    char name[32];
} test_typedef_struct;

// Typedef for function pointer
typedef int (*test_typedef_function_ptr)(int, int);

// ===== MACRO DEFINITIONS =====

// Simple macro definition
#define TEST_MACRO_CONSTANT 3.14159

// Function-like macro
#define TEST_MACRO_FUNCTION(x) ((x) * (x))

// Function-like macro with multiple statements
#define TEST_MACRO_COMPLEX(a, b) do { \\
    typeof(a) temp = a; \\
    a = b; \\
    b = temp; \\
} while(0)

// ===== GLOBAL VARIABLES =====

// Global variable declaration
int test_global_variable = 0;
const char* test_global_string = "Test String";

// ===== STATIC DECLARATIONS =====

// Static variable
static int test_static_variable = 100;

// Static function
static void test_static_function() {
    test_global_variable++;
}

// ===== EXTERN DECLARATIONS =====

// Extern function declaration
extern int test_extern_function(void);

// Extern variable declaration
extern int test_extern_variable;

// ===== FUNCTION POINTERS =====

// Function pointer declaration
int (*test_function_ptr)(int, int);

// Function that returns a function pointer
test_typedef_function_ptr test_function_returning_ptr(char op) {
    switch (op) {
        case '+': return test_function_definition;
        default: return 0;
    }
}

// ===== ARRAY DECLARATIONS =====

// Array declaration
int test_array_declaration[10];

// Multi-dimensional array
char test_multidim_array[3][3];

// ===== POINTER DECLARATIONS =====

// Basic pointer declaration
int *test_pointer_declaration;

// Double pointer
char **test_double_pointer;

// Void pointer
void *test_void_pointer;

// ===== C11 FEATURES =====

// Anonymous union in struct
struct test_anonymous_union {
    int id;
    struct {
        union {
            struct {
                unsigned char b, g, r, a;
            };
            unsigned int color;
        };
    };
};

// _Atomic type (C11)
typedef _Atomic int test_atomic_int;

// _Alignas and _Alignof (C11)
struct test_alignas_struct {
    char c;
    _Alignas(8) int i;
    double d;
};
`

// C test options
const cOptions = {
	language: "c",
	wasmFile: "tree-sitter-c.wasm",
	queryString: cQuery,
	extKey: "c",
	content: sampleCContent,
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

describe("parseSourceCodeDefinitionsForFile with C", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	// Debug test to inspect the tree structure
	it("should debug C tree structure", async () => {
		// Initialize tree-sitter
		const TreeSitter = await initializeTreeSitter()

		// Create parser and load C language
		const parser = new TreeSitter()
		const wasmPath = path.join(process.cwd(), "dist/tree-sitter-c.wasm")
		const cLang = await TreeSitter.Language.load(wasmPath)
		parser.setLanguage(cLang)

		// Parse a simple C code snippet
		const simpleCode = `
struct Point {
    int x;
    int y;
};

int add(int a, int b) {
    return a + b;
}
`
		// Parse the content
		const tree = parser.parse(simpleCode)

		// Print the tree structure for debugging
		debugLog("C TREE STRUCTURE:\n" + tree.rootNode.toString())

		// Test passes if we can inspect the tree
		expect(tree).toBeDefined()
	})

	// Function definitions
	it("should capture function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for specific function definition
		expect(resultLines.some((line) => line.includes("test_function_definition"))).toBe(true)
	})

	it("should capture functions with parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with parameters
		expect(resultLines.some((line) => line.includes("test_function_with_params"))).toBe(true)
	})

	it("should capture functions with pointer parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with pointer parameters
		expect(resultLines.some((line) => line.includes("test_function_with_pointers"))).toBe(true)
	})

	it("should capture functions with array parameters", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for function with array parameters
		expect(resultLines.some((line) => line.includes("test_function_with_array"))).toBe(true)
	})

	it("should capture variadic functions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)
		const resultLines = result?.split("\n") || []

		// Check for variadic function
		expect(resultLines.some((line) => line.includes("test_variadic_function"))).toBe(true)
	})

	// Note: Inline functions are not currently supported by the parser

	// Struct definitions
	it("should capture struct definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for specific struct definition
		expect(result).toContain("struct test_struct_definition")
	})

	it("should capture nested struct definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for nested struct
		expect(result).toContain("struct test_nested_struct")
	})

	it("should capture structs with bit fields", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for struct with bit fields
		expect(result).toContain("struct test_struct_with_bitfields")
	})

	it("should capture structs with function pointer members", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for struct with function pointer member
		expect(result).toContain("struct test_struct_with_function_ptr")
	})

	// Note: Union definitions are not fully supported by the parser

	// Enum definitions
	it("should capture enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for enum definition
		expect(result).toContain("enum test_enum_definition")
	})

	// Typedef declarations
	it("should capture typedef struct declarations", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for typedef struct
		expect(result).toContain("typedef struct")
	})

	// Note: The parser only supports typedef struct declarations, not primitive or function pointer typedefs

	// Note: Simple macro definitions are not supported by the parser, only complex ones

	// Note: The following constructs are not currently supported by the parser:
	// - Global variables
	// - Static variables and functions
	// - Extern declarations
	// - Function pointers
	// - Array declarations
	// - Pointer declarations

	// C11 features
	it("should capture C11 anonymous union structs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for C11 anonymous union struct
		expect(result).toContain("struct test_anonymous_union")
	})

	it("should capture C11 alignas structs", async () => {
		const result = await testParseSourceCodeDefinitions("/test/file.c", sampleCContent, cOptions)

		// Check for C11 alignas struct
		expect(result).toContain("struct test_alignas_struct")
	})

	// Note: C11 atomic types are not currently supported by the parser
})
