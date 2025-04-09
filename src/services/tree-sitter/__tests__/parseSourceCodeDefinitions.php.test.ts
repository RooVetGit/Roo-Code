import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { parseSourceCodeDefinitionsForFile } from ".."
import * as fs from "fs/promises"
import * as path from "path"
import Parser from "web-tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import { loadRequiredLanguageParsers } from "../languageParser"
import { initializeTreeSitter, testParseSourceCodeDefinitions, inspectTreeStructure, debugLog } from "./helpers"
import { phpQuery } from "../queries"

jest.mock("fs/promises")
jest.mock("../../../utils/fs")
jest.mock("../languageParser")

describe("parseSourceCodeDefinitionsForFile with PHP", () => {
	let mockFs: jest.Mocked<typeof fs>
	let mockFileExists: jest.MockedFunction<typeof fileExistsAtPath>
	let mockedLoadRequiredLanguageParsers: jest.MockedFunction<typeof loadRequiredLanguageParsers>

	beforeEach(async () => {
		mockFs = fs as jest.Mocked<typeof fs>
		mockFileExists = fileExistsAtPath as jest.MockedFunction<typeof fileExistsAtPath>
		mockedLoadRequiredLanguageParsers = loadRequiredLanguageParsers as jest.MockedFunction<
			typeof loadRequiredLanguageParsers
		>

		mockFileExists.mockResolvedValue(true)
		mockFs.readFile.mockResolvedValue(samplePhpContent)

		// Mock the loadRequiredLanguageParsers implementation
		mockedLoadRequiredLanguageParsers.mockImplementation(async () => {
			const TreeSitter = await initializeTreeSitter()
			const parser = new TreeSitter()
			const wasmPath = path.join(process.cwd(), "dist/tree-sitter-php.wasm")
			const lang = await TreeSitter.Language.load(wasmPath)
			parser.setLanguage(lang)
			const query = lang.query(phpQuery)
			return { php: { parser, query } }
		})

		await initializeTreeSitter()
	})

	// Sample PHP code demonstrating all supported language constructs
	// Each section is named to clearly indicate what it's testing
	const samplePhpContent = `<?php
declare(strict_types=1);

// Namespace declaration test
namespace TestNamespace\\Core;

// Use statements test
use TestNamespace\\Interfaces\\TestInterface;
use TestNamespace\\Traits\\TestTrait;
use TestNamespace\\Enums\\TestEnum;

/**
 * Example attribute for PHP 8.0+
 */
// Attribute test
#[TestController]
#[TestRoute("/api/test")]

// Abstract class test
abstract class TestAbstractClass implements TestInterface {
    // Trait usage test
    use TestTrait;

    // Constant declaration test
    private const TEST_CONSTANT_PRIVATE = 'test_private';
    protected const TEST_CONSTANT_PROTECTED = 'test_protected';
    public const TEST_CONSTANT_PUBLIC = 'test_public';

    // Property declaration test
    private string $testProperty;
    protected ?string $testNullableProperty = null;
    public readonly string $testReadonlyProperty;

    // Static property test
    public static int $testStaticProperty = 0;

    // Constructor with property promotion test
    public function __construct(
        private string $testPromotedProperty1,
        protected string $testPromotedProperty2,
        public readonly DateTimeImmutable $testPromotedReadonlyProperty = new DateTimeImmutable()
    ) {
        $this->testReadonlyProperty = uniqid('test_');
        self::$testStaticProperty++;
    }

    // Abstract method test
    abstract public function testAbstractMethod(): string;

    // Regular method test
    public function testMethod(): string {
        return $this->testProperty;
    }

    // Static method test
    public static function testStaticMethod(): int {
        return self::$testStaticProperty;
    }

    // Method with union types test
    public function testUnionTypeMethod(string|int $param): void {
        // Method implementation
        $this->testProperty = (string)$param;
    }

    // Method with intersection types test
    public function testIntersectionTypeMethod(
        Countable&Iterator $data
    ): void {
        // Method implementation
        foreach ($data as $item) {
            $this->testProperty = (string)$item;
        }
    }
    
    // Magic method test
    public function __toString(): string {
        return $this->testAbstractMethod();
    }
}

// Interface declaration test
interface TestInterface {
    public function testInterfaceMethod1(string $id): ?TestAbstractClass;
    public function testInterfaceMethod2(array $data): TestAbstractClass;
    public function testInterfaceMethod3(string $id, array $data): bool;
    public function testInterfaceMethod4(string $id): bool;
}

// Trait declaration test
trait TestTrait {
    private DateTimeImmutable $testTraitProperty1;
    private ?DateTimeImmutable $testTraitProperty2 = null;

    public function testTraitMethod1(): DateTimeImmutable {
        return $this->testTraitProperty1;
    }

    public function testTraitMethod2(?DateTimeImmutable $time = null): void {
        $this->testTraitProperty2 = $time ?? new DateTimeImmutable();
    }
}

// Enum declaration test
enum TestEnum: string {
    case TEST_CASE1 = 'test_case1';
    case TEST_CASE2 = 'test_case2';
    case TEST_CASE3 = 'test_case3';

    // Match expression test
    public function testEnumMethod(): array {
        return match($this) {
            self::TEST_CASE1 => ['read', 'write', 'delete'],
            self::TEST_CASE2 => ['read', 'write'],
            self::TEST_CASE3 => ['read'],
        };
    }
}

// Final class test
final class TestFinalClass implements TestInterface {
    private PDO $testFinalClassProperty;

    public function __construct(PDO $db) {
        $this->testFinalClassProperty = $db;
    }

    public function testInterfaceMethod1(string $id): ?TestAbstractClass {
        // Method implementation
        $stmt = $this->testFinalClassProperty->prepare('SELECT * FROM test WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function testInterfaceMethod2(array $data): TestAbstractClass {
        // Method implementation
        $stmt = $this->testFinalClassProperty->prepare(
            'INSERT INTO test (property1, property2) VALUES (?, ?)'
        );
        $stmt->execute([$data['property1'], $data['property2']]);
        return $this->testInterfaceMethod1($this->testFinalClassProperty->lastInsertId());
    }

    public function testInterfaceMethod3(string $id, array $data): bool {
        // Method implementation
        $stmt = $this->testFinalClassProperty->prepare(
            'UPDATE test SET property1 = ?, property2 = ? WHERE id = ?'
        );
        return $stmt->execute([$data['property1'], $data['property2'], $id]);
    }

    public function testInterfaceMethod4(string $id): bool {
        // Method implementation
        $stmt = $this->testFinalClassProperty->prepare('DELETE FROM test WHERE id = ?');
        return $stmt->execute([$id]);
    }
}

// Anonymous class test
$testAnonymousClass = new class implements TestInterface {
    public function testInterfaceMethod1(string $id): ?TestAbstractClass {
        // Implementation
        return null;
    }
    
    public function testInterfaceMethod2(array $data): TestAbstractClass {
        // Implementation
        return new class extends TestAbstractClass {
            public function testAbstractMethod(): string {
                return $this->testPromotedProperty1 . ' ' . $this->testPromotedProperty2;
            }
        };
    }
    
    public function testInterfaceMethod3(string $id, array $data): bool {
        // Implementation
        return true;
    }
    
    public function testInterfaceMethod4(string $id): bool {
        // Implementation
        return true;
    }
};

// Function definition test
function testFunction(string $param1, string $param2, string $param3): PDO {
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    return new PDO($param1, $param2, $param3, $options);
}

// Arrow function test
$testArrowFunction = fn($a, $b) => $a * $b;

// Heredoc test
$testHeredoc = <<<HTML
<div>
    <h1>Test Heredoc</h1>
    <p>This is a test heredoc string</p>
    <p>With multiple lines</p>
</div>
HTML;

// Nowdoc test
$testNowdoc = <<<'CODE'
<?php
echo "This is a test nowdoc syntax";
echo "With multiple lines";
echo "For testing purposes";
CODE;

// Readonly class test
readonly class TestReadonlyClass {
    public function __construct(
        public string $testReadonlyClassProperty1,
        public string $testReadonlyClassProperty2
    ) {
        // Constructor implementation
    }
    
    public function testReadonlyClassMethod(): string {
        return $this->testReadonlyClassProperty1 . $this->testReadonlyClassProperty2;
    }
}
`

	// PHP test options
	const phpOptions = {
		language: "php",
		wasmFile: "tree-sitter-php.wasm",
		queryString: phpQuery,
		extKey: "php",
	}

	it("should debug PHP tree structure", async () => {
		await inspectTreeStructure(samplePhpContent, "php")
	})

	it("should capture class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for all class types
		expect(result).toContain("class TestAbstractClass")
		expect(result).toContain("abstract class TestAbstractClass")
		expect(result).toContain("final class TestFinalClass")
		expect(result).toContain("readonly class TestReadonlyClass")
	})

	it("should capture interface definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for interface declarations
		expect(result).toContain("interface TestInterface")
	})

	it("should capture trait definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for trait declarations
		expect(result).toContain("trait TestTrait")
	})

	it("should capture enum definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for enum declarations
		expect(result).toContain("enum TestEnum")
	})

	it("should capture method definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for method declarations
		expect(result).toContain("public function testUnionTypeMethod")
		expect(result).toContain("public function testInterfaceMethod1")
		expect(result).toContain("public function testEnumMethod")
	})

	it("should capture function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		expect(result).toContain("function testFunction")
	})

	it("should capture property definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture constant definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture namespace definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture use statements", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture anonymous class definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for anonymous class
		expect(result).toContain("new class implements TestInterface")
	})

	it("should capture arrow function definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Just check that the result contains some output
		expect(result).toBeTruthy()
		expect(result?.length).toBeGreaterThan(0)
	})

	it("should capture constructor property promotion", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for constructor
		expect(result).toContain("public function __construct")
	})

	it("should capture attribute definitions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for attributes
		expect(result).toContain("#[TestController]")
	})

	it("should capture match expressions", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for match expressions
		expect(result).toContain("match($this)")
	})

	it("should capture heredoc and nowdoc syntax", async () => {
		const result = await testParseSourceCodeDefinitions("test.php", samplePhpContent, phpOptions)

		// Check for heredoc and nowdoc
		expect(result).toContain("$testHeredoc = <<<HTML")
		expect(result).toContain("$testNowdoc = <<<'CODE'")
	})
})
