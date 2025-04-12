export default String.raw`<?php
declare(strict_types=1);

// Testing namespace and use statements
namespace TestNamespace\\Core;

use TestNamespace\\Interfaces\\TestInterface;
use TestNamespace\\Traits\\TestTrait;
use TestNamespace\\Enums\\TestEnum;

// Testing class with properties and methods
class TestClassDefinition {
    private string $testPrivateProperty;
    protected int $testProtectedProperty;
    public ?array $testNullableProperty;
    
    public function testMethodDefinition(
        string $testParam1,
        array $testParam2 = [],
        ?int $testParam3 = null
    ): void {
        $this->testPrivateProperty = $testParam1;
    }
}

// Testing interface with type hints
interface TestInterfaceDefinition {
    public function testInterfaceMethod(
        TestClassDefinition $testParam1,
        string $testParam2
    ): array;
    
    public function testNullableReturn(): ?string;
    public function testVoidReturn(): void;
    public function testMixedReturn(): mixed;
}

// Testing trait with visibility modifiers
trait TestTraitDefinition {
    private string $testTraitProperty = '';
    
    protected function testTraitMethod(
        int $testParam = 0,
        bool $testFlag = false
    ): string {
        return $this->testTraitProperty;
    }
}

// Testing enum with methods
enum TestEnumDefinition: string {
    case TEST_VALUE_ONE = 'one';
    case TEST_VALUE_TWO = 'two';
    case TEST_VALUE_THREE = 'three';
    
    public function testEnumMethod(): array {
        return match($this) {
            self::TEST_VALUE_ONE => ['read'],
            self::TEST_VALUE_TWO => ['read', 'write'],
            self::TEST_VALUE_THREE => ['read', 'write', 'delete'],
        };
    }
}

// Testing abstract class with attributes
#[TestAttribute]
abstract class TestAbstractClassDefinition {
    protected const TEST_CONSTANT = 'test_value';
    private static string $testStaticProperty = '';
    
    public function __construct(
        private string $testPromotedProperty,
        protected readonly int $testReadonlyProperty
    ) {
        self::$testStaticProperty = 'test';
    }
    
    abstract public function testAbstractMethod(): string;
    
    public static function testStaticMethod(): string {
        return self::$testStaticProperty;
    }
}

// Testing final class implementation
final class TestFinalClassDefinition extends TestAbstractClassDefinition {
    public function testAbstractMethod(): string {
        return $this->testPromotedProperty;
    }
    
    public function testUnionTypes(string|int $param): bool {
        return is_string($param);
    }
    
    public function testIntersectionTypes(
        Countable&Iterator $param
    ): int {
        return count($param);
    }
}

// Testing anonymous class
$testAnonymousClass = new class extends TestClassDefinition {
    public function testAnonymousMethod(): string {
        return 'anonymous';
    }
};

// Testing global function
function testGlobalFunction(
    string $testParam1,
    ?array $testParam2 = null
): mixed {
    return $testParam2 ?? $testParam1;
}

// Testing arrow function
$testArrowFunction = fn(int $x, int $y): int => $x + $y;

// Testing heredoc syntax
$testHeredoc = <<<HTML
<div class="test">
    <h1>Test Title</h1>
    <p>Test paragraph with multiple lines
       to ensure proper parsing</p>
    <span>Additional test content</span>
</div>
HTML;

// Testing nowdoc syntax
$testNowdoc = <<<'SQL'
SELECT column1, column2
FROM test_table
WHERE condition = 'test'
GROUP BY column1
HAVING COUNT(*) > 1
ORDER BY column2 DESC
SQL;`
