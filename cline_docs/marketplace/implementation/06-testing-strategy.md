# Testing Strategy

This document outlines the comprehensive testing strategy for the Marketplace, including unit tests, integration tests, and test data management.

## Testing Philosophy

The Marketplace follows a multi-layered testing approach to ensure reliability and maintainability:

1. **Unit Testing**: Testing individual components in isolation
2. **Integration Testing**: Testing interactions between components
3. **End-to-End Testing**: Testing complete user workflows
4. **Test-Driven Development**: Writing tests before implementation when appropriate
5. **Continuous Testing**: Running tests automatically on code changes

## Test Setup and Dependencies

### Required Dependencies

The Marketplace requires specific testing dependencies:

```json
{
	"devDependencies": {
		"@types/jest": "^29.0.0",
		"@types/mocha": "^10.0.0",
		"@vscode/test-electron": "^2.3.8",
		"jest": "^29.0.0",
		"ts-jest": "^29.0.0"
	}
}
```

### E2E Test Configuration

End-to-end tests require specific setup:

```typescript
// e2e/src/runTest.ts
import * as path from "path"
import { runTests } from "@vscode/test-electron"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: ["--disable-extensions"],
		})
	} catch (err) {
		console.error("Failed to run tests:", err)
		process.exit(1)
	}
}

main()
```

### Test Framework Setup

```typescript
// e2e/src/suite/index.ts
import * as path from "path"
import * as Mocha from "mocha"
import { glob } from "glob"

export async function run(): Promise<void> {
	const mocha = new Mocha({
		ui: "tdd",
		color: true,
		timeout: 60000,
	})

	const testsRoot = path.resolve(__dirname, ".")
	const files = await glob("**/**.test.js", { cwd: testsRoot })

	files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

	try {
		return new Promise<void>((resolve, reject) => {
			mocha.run((failures) => {
				failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve()
			})
		})
	} catch (err) {
		console.error(err)
		throw err
	}
}
```

### TypeScript Configuration

E2E tests require specific TypeScript configuration:

```json
// e2e/tsconfig.json
{
	"compilerOptions": {
		"module": "commonjs",
		"target": "ES2020",
		"lib": ["ES2020"],
		"sourceMap": true,
		"strict": true,
		"types": ["mocha", "node", "@vscode/test-electron"]
	},
	"exclude": ["node_modules", ".vscode-test"]
}
```

## Unit Tests

Unit tests focus on testing individual functions, classes, and components in isolation.

### Backend Unit Tests

Backend unit tests verify the functionality of core services and utilities:

#### MetadataScanner Tests

```typescript
describe("MetadataScanner", () => {
	let scanner: MetadataScanner

	beforeEach(() => {
		scanner = new MetadataScanner()
	})

	describe("parseMetadataFile", () => {
		it("should parse valid YAML metadata", async () => {
			// Mock file system
			jest.spyOn(fs, "readFile").mockImplementation((path, options, callback) => {
				callback(
					null,
					Buffer.from(`
          name: "Test Package"
          description: "A test package"
          version: "1.0.0"
          type: "package"
        `),
				)
			})

			const result = await scanner["parseMetadataFile"]("test/path/metadata.en.yml")

			expect(result).toEqual({
				name: "Test Package",
				description: "A test package",
				version: "1.0.0",
				type: "package",
			})
		})

		it("should handle invalid YAML", async () => {
			// Mock file system with invalid YAML
			jest.spyOn(fs, "readFile").mockImplementation((path, options, callback) => {
				callback(
					null,
					Buffer.from(`
          name: "Invalid YAML
          description: Missing quote
        `),
				)
			})

			await expect(scanner["parseMetadataFile"]("test/path/metadata.en.yml")).rejects.toThrow()
		})
	})

	describe("scanDirectory", () => {
		// Tests for directory scanning
	})
})
```

#### MarketplaceManager Tests

```typescript
describe("MarketplaceManager", () => {
	let manager: MarketplaceManager
	let mockContext: vscode.ExtensionContext

	beforeEach(() => {
		// Create mock context
		mockContext = {
			extensionPath: "/test/path",
			globalStorageUri: { fsPath: "/test/storage" },
			globalState: {
				get: jest.fn().mockImplementation((key, defaultValue) => defaultValue),
				update: jest.fn().mockResolvedValue(undefined),
			},
		} as unknown as vscode.ExtensionContext

		manager = new MarketplaceManager(mockContext)
	})

	describe("filterItems", () => {
		it("should filter by type", () => {
			// Set up test data
			manager["currentItems"] = [
				{ name: "Item 1", type: "mode", description: "Test item 1" },
				{ name: "Item 2", type: "package", description: "Test item 2" },
			] as MarketplaceItem[]

			const result = manager.filterItems({ type: "mode" })

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("Item 1")
		})

		it("should filter by search term", () => {
			// Set up test data
			manager["currentItems"] = [
				{ name: "Alpha Item", type: "mode", description: "Test item" },
				{ name: "Beta Item", type: "package", description: "Another test" },
			] as MarketplaceItem[]

			const result = manager.filterItems({ search: "alpha" })

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("Alpha Item")
		})

		// More filter tests...
	})

	describe("addSource", () => {
		// Tests for adding sources
	})
})
```

#### Search Utilities Tests

```typescript
describe("searchUtils", () => {
	describe("containsSearchTerm", () => {
		it("should return true for exact matches", () => {
			expect(containsSearchTerm("hello world", "hello")).toBe(true)
		})

		it("should be case insensitive", () => {
			expect(containsSearchTerm("Hello World", "hello")).toBe(true)
			expect(containsSearchTerm("hello world", "WORLD")).toBe(true)
		})

		it("should handle undefined inputs", () => {
			expect(containsSearchTerm(undefined, "test")).toBe(false)
			expect(containsSearchTerm("test", "")).toBe(false)
		})
	})

	describe("itemMatchesSearch", () => {
		it("should match on name", () => {
			const item = {
				name: "Test Item",
				description: "Description",
			}

			expect(itemMatchesSearch(item, "test")).toEqual({
				matched: true,
				matchReason: {
					nameMatch: true,
					descriptionMatch: false,
				},
			})
		})

		// More search matching tests...
	})
})
```

### Frontend Unit Tests

Frontend unit tests verify the functionality of UI components:

#### MarketplaceItemCard Tests

```typescript
describe("MarketplaceItemCard", () => {
  const mockItem: MarketplaceItem = {
    name: "Test Package",
    description: "A test package",
    type: "package",
    url: "https://example.com",
    repoUrl: "https://github.com/example/repo",
    tags: ["test", "example"],
    version: "1.0.0",
    lastUpdated: "2025-04-01"
  };

  const mockFilters = { type: "", search: "", tags: [] };
  const mockSetFilters = jest.fn();
  const mockSetActiveTab = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    render(
      <MarketplaceItemCard
        item={mockItem}
        filters={mockFilters}
        setFilters={mockSetFilters}
        activeTab="browse"
        setActiveTab={mockSetActiveTab}
      />
    );

    expect(screen.getByText("Test Package")).toBeInTheDocument();
    expect(screen.getByText("A test package")).toBeInTheDocument();
    expect(screen.getByText("Package")).toBeInTheDocument();
  });

  it("handles tag clicks", () => {
    render(
      <MarketplaceItemCard
        item={mockItem}
        filters={mockFilters}
        setFilters={mockSetFilters}
        activeTab="browse"
        setActiveTab={mockSetActiveTab}
      />
    );

    fireEvent.click(screen.getByText("test"));

    expect(mockSetFilters).toHaveBeenCalledWith({
      type: "",
      search: "",
      tags: ["test"]
    });
  });

  // More component tests...
});
```

#### ExpandableSection Tests

```typescript
describe("ExpandableSection", () => {
  it("renders collapsed by default", () => {
    render(
      <ExpandableSection title="Test Section">
        <div>Test Content</div>
      </ExpandableSection>
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.queryByText("Test Content")).not.toBeVisible();
  });

  it("expands when clicked", () => {
    render(
      <ExpandableSection title="Test Section">
        <div>Test Content</div>
      </ExpandableSection>
    );

    fireEvent.click(screen.getByText("Test Section"));

    expect(screen.getByText("Test Content")).toBeVisible();
  });

  it("can be expanded by default", () => {
    render(
      <ExpandableSection title="Test Section" defaultExpanded={true}>
        <div>Test Content</div>
      </ExpandableSection>
    );

    expect(screen.getByText("Test Content")).toBeVisible();
  });

  // More component tests...
});
```

#### TypeGroup Tests

```typescript
describe("TypeGroup", () => {
  const mockItems = [
    { name: "Item 1", description: "Description 1" },
    { name: "Item 2", description: "Description 2" }
  ];

  it("renders type heading and items", () => {
    render(<TypeGroup type="mode" items={mockItems} />);

    expect(screen.getByText("Modes")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("highlights items matching search term", () => {
    render(<TypeGroup type="mode" items={mockItems} searchTerm="item 1" />);

    const item1 = screen.getByText("Item 1");
    const item2 = screen.getByText("Item 2");

    expect(item1.className).toContain("text-vscode-textLink");
    expect(item2.className).not.toContain("text-vscode-textLink");
    expect(screen.getByText("match")).toBeInTheDocument();
  });

  // More component tests...
});
```

## Integration Tests

Integration tests verify that different components work together correctly.

### Backend Integration Tests

```typescript
describe("Marketplace Integration", () => {
	let manager: MarketplaceManager
	let metadataScanner: MetadataScanner
	let templateItems: MarketplaceItem[]

	beforeAll(async () => {
		// Load real data from template
		metadataScanner = new MetadataScanner()
		const templatePath = path.resolve(__dirname, "marketplace-template")
		templateItems = await metadataScanner.scanDirectory(templatePath, "https://example.com")
	})

	beforeEach(() => {
		// Create a real context-like object
		const context = {
			extensionPath: path.resolve(__dirname, "../../../../"),
			globalStorageUri: { fsPath: path.resolve(__dirname, "../../../../mock/settings/path") },
		} as vscode.ExtensionContext

		// Create real instances
		manager = new MarketplaceManager(context)

		// Set up manager with template data
		manager["currentItems"] = [...templateItems]
	})

	describe("Message Handler Integration", () => {
		it("should handle search messages", async () => {
			const message = {
				type: "search",
				search: "data platform",
				typeFilter: "",
				tagFilters: [],
			}

			const result = await handleMarketplaceMessages(message, manager)

			expect(result.type).toBe("searchResults")
			expect(result.data).toHaveLength(1)
			expect(result.data[0].name).toContain("Data Platform")
		})

		it("should handle type filter messages", async () => {
			const message = {
				type: "search",
				search: "",
				typeFilter: "mode",
				tagFilters: [],
			}

			const result = await handleMarketplaceMessages(message, manager)

			expect(result.type).toBe("searchResults")
			expect(result.data.every((item) => item.type === "mode")).toBe(true)
		})

		// More message handler tests...
	})

	describe("End-to-End Flow", () => {
		it("should find items with matching subcomponents", async () => {
			const message = {
				type: "search",
				search: "validator",
				typeFilter: "",
				tagFilters: [],
			}

			const result = await handleMarketplaceMessages(message, manager)

			expect(result.data.length).toBeGreaterThan(0)

			// Check that subcomponents are marked as matches
			const hasMatchingSubcomponent = result.data.some((item) =>
				item.items?.some((subItem) => subItem.matchInfo?.matched),
			)
			expect(hasMatchingSubcomponent).toBe(true)
		})

		// More end-to-end flow tests...
	})
})
```

### Frontend Integration Tests

```typescript
describe("Marketplace UI Integration", () => {
  const mockItems: MarketplaceItem[] = [
    {
      name: "Test Package",
      description: "A test package",
      type: "package",
      url: "https://example.com",
      repoUrl: "https://github.com/example/repo",
      tags: ["test", "example"],
      items: [
        {
          type: "mode",
          path: "/test/path",
          metadata: {
            name: "Test Mode",
            description: "A test mode",
            type: "mode"
          }
        }
      ]
    },
    {
      name: "Test Mode",
      description: "Another test item",
      type: "mode",
      url: "https://example.com",
      repoUrl: "https://github.com/example/repo",
      tags: ["example"]
    }
  ];

  beforeEach(() => {
    // Mock VSCode API
    (vscode.postMessage as jest.Mock).mockClear();
  });

  it("should filter items when search is entered", async () => {
    render(<MarketplaceView initialItems={mockItems} />);

    // Both items should be visible initially
    expect(screen.getByText("Test Package")).toBeInTheDocument();
    expect(screen.getByText("Test Mode")).toBeInTheDocument();

    // Enter search term
    const searchInput = screen.getByPlaceholderText("Search items...");
    fireEvent.change(searchInput, { target: { value: "another" } });

    // Wait for debounce
    await waitFor(() => {
      expect(screen.queryByText("Test Package")).not.toBeInTheDocument();
      expect(screen.getByText("Test Mode")).toBeInTheDocument();
    });
  });

  it("should expand details when search matches subcomponents", async () => {
    render(<MarketplaceView initialItems={mockItems} />);

    // Enter search term that matches a subcomponent
    const searchInput = screen.getByPlaceholderText("Search items...");
    fireEvent.change(searchInput, { target: { value: "test mode" } });

    // Wait for debounce and expansion
    await waitFor(() => {
      expect(screen.getByText("Test Mode")).toBeInTheDocument();
      expect(screen.getByText("A test mode")).toBeInTheDocument();
    });

    // Check that the match is highlighted
    const modeElement = screen.getByText("Test Mode");
    expect(modeElement.className).toContain("text-vscode-textLink");
  });

  // More UI integration tests...
});
```

## Test Data Management

The Marketplace uses several approaches to manage test data:

### Mock Data

Mock data is used for simple unit tests:

```typescript
const mockItems: MarketplaceItem[] = [
	{
		name: "Test Package",
		description: "A test package",
		type: "package",
		url: "https://example.com",
		repoUrl: "https://github.com/example/repo",
		tags: ["test", "example"],
		version: "1.0.0",
	},
	// More mock items...
]
```

### Test Fixtures

Test fixtures provide more complex data structures:

```typescript
// fixtures/metadata.ts
export const metadataFixtures = {
	basic: {
		name: "Basic Package",
		description: "A basic package for testing",
		version: "1.0.0",
		type: "package",
	},

	withTags: {
		name: "Tagged Package",
		description: "A package with tags",
		version: "1.0.0",
		type: "package",
		tags: ["test", "fixture", "example"],
	},

	withSubcomponents: {
		name: "Complex Package",
		description: "A package with subcomponents",
		version: "1.0.0",
		type: "package",
		items: [
			{
				type: "mode",
				path: "/test/path/mode",
				metadata: {
					name: "Test Mode",
					description: "A test mode",
					type: "mode",
				},
			},
			{
				type: "mcp",
				path: "/test/path/server",
				metadata: {
					name: "Test Server",
					description: "A test server",
					type: "mcp",
				},
			},
		],
	},
}
```

### Template Data

Real template data is used for integration tests:

```typescript
beforeAll(async () => {
	// Load real data from template
	metadataScanner = new MetadataScanner()
	const templatePath = path.resolve(__dirname, "marketplace-template")
	templateItems = await metadataScanner.scanDirectory(templatePath, "https://example.com")
})
```

### Test Data Generators

Generators create varied test data:

```typescript
// Test data generator
function generatePackageItems(count: number): MarketplaceItem[] {
	const types: MarketplaceItemType[] = ["mode", "mcp", "package", "prompt"]
	const tags = ["test", "example", "data", "ui", "server", "client"]

	return Array.from({ length: count }, (_, i) => {
		const type = types[i % types.length]
		const randomTags = tags.filter(() => Math.random() > 0.5).slice(0, Math.floor(Math.random() * 4))

		return {
			name: `Test ${type} ${i + 1}`,
			description: `This is a test ${type} for testing purposes`,
			type,
			url: `https://example.com/${type}/${i + 1}`,
			repoUrl: "https://github.com/example/repo",
			tags: randomTags.length ? randomTags : undefined,
			version: "1.0.0",
			lastUpdated: new Date().toISOString(),
			items: type === "package" ? generateSubcomponents(Math.floor(Math.random() * 5) + 1) : undefined,
		}
	})
}

function generateSubcomponents(count: number): MarketplaceItem["items"] {
	const types: MarketplaceItemType[] = ["mode", "mcp", "prompt"]

	return Array.from({ length: count }, (_, i) => {
		const type = types[i % types.length]

		return {
			type,
			path: `/test/path/${type}/${i + 1}`,
			metadata: {
				name: `Test ${type} ${i + 1}`,
				description: `This is a test ${type} subcomponent`,
				type,
			},
		}
	})
}
```

## Type Filter Test Plan

This section outlines the test plan for the type filtering functionality in the Marketplace, particularly focusing on the improvements to make type filter behavior consistent with search term behavior.

### Unit Tests

#### 1. Basic Type Filtering Tests

**Test: Filter by Package Type**

- **Input**: Items with various types including "package"
- **Filter**: `{ type: "package" }`
- **Expected**: Only items with type "package" are returned
- **Verification**: Check that the returned items all have type "package"

**Test: Filter by Mode Type**

- **Input**: Items with various types including "mode"
- **Filter**: `{ type: "mode" }`
- **Expected**: Only items with type "mode" are returned
- **Verification**: Check that the returned items all have type "mode"

**Test: Filter by mcp Type**

- **Input**: Items with various types including "mcp"
- **Filter**: `{ type: "mcp" }`
- **Expected**: Only items with type "mcp" are returned
- **Verification**: Check that the returned items all have type "mcp"

#### 2. Package with Subcomponents Tests

**Test: Package with Matching Subcomponents**

- **Input**: A package with subcomponents of various types
- **Filter**: `{ type: "mode" }`
- **Expected**: The package is returned if it contains at least one subcomponent with type "mode"
- **Verification**:
    - Check that the package is returned
    - Check that `item.matchInfo.matched` is `true`
    - Check that `item.matchInfo.matchReason.hasMatchingSubcomponents` is `true`
    - Check that subcomponents with type "mode" have `subItem.matchInfo.matched` set to `true`
    - Check that subcomponents with other types have `subItem.matchInfo.matched` set to `false`

**Test: Package with No Matching Subcomponents**

- **Input**: A package with subcomponents of various types, but none matching the filter
- **Filter**: `{ type: "prompt" }`
- **Expected**: The package is not returned
- **Verification**: Check that the package is not in the returned items

**Test: Package with No Subcomponents**

- **Input**: A package with no subcomponents
- **Filter**: `{ type: "mode" }`
- **Expected**: The package is not returned (since it's not a mode and has no subcomponents)
- **Verification**: Check that the package is not in the returned items

#### 3. Combined Filtering Tests

**Test: Type Filter and Search Term**

- **Input**: Various items including packages with subitems
- **Filter**: `{ type: "mode", search: "test" }`
- **Expected**: Only items that match both the type filter and the search term are returned
- **Verification**:
    - Check that all returned items have type "mode" or are packages with mode subcomponents
    - Check that all returned items have "test" in their name or description, or have subcomponents with "test" in their name or description

**Test: Type Filter and Tags**

- **Input**: Various items with different tags
- **Filter**: `{ type: "mode", tags: ["test"] }`
- **Expected**: Only items that match both the type filter and have the "test" tag are returned
- **Verification**: Check that all returned items have type "mode" or are packages with mode subcomponents, and have the "test" tag

### Integration Tests

#### 1. UI Display Tests

**Test: Type Filter UI Updates**

- **Action**: Apply a type filter in the UI
- **Expected**:
    - The UI shows only items that match the filter
    - For packages, subcomponents that match the filter are highlighted or marked in some way
- **Verification**: Visually inspect the UI to ensure it correctly displays which items and subcomponents match the filter

**Test: Type Filter and Search Combination**

- **Action**: Apply both a type filter and a search term in the UI
- **Expected**: The UI shows only items that match both the type filter and the search term
- **Verification**: Visually inspect the UI to ensure it correctly displays which items match both filters

#### 2. Real Data Tests

**Test: Filter with Real Package Data**

- **Input**: Real package data from the default package source
- **Action**: Apply various type filters
- **Expected**: The results match the expected behavior for each filter
- **Verification**: Check that the results are consistent with the expected behavior

### Regression Tests

#### 1. Search Term Filtering

**Test: Search Term Only**

- **Input**: Various items including packages with subcomponents
- **Filter**: `{ search: "test" }`
- **Expected**: The behavior is unchanged from before the type filter improvements
- **Verification**: Compare the results with the expected behavior from the previous implementation

#### 2. Tag Filtering

**Test: Tag Filter Only**

- **Input**: Various items with different tags
- **Filter**: `{ tags: ["test"] }`
- **Expected**: The behavior is unchanged from before the type filter improvements
- **Verification**: Compare the results with the expected behavior from the previous implementation

#### 3. No Filters

**Test: No Filters Applied**

- **Input**: Various items
- **Filter**: `{}`
- **Expected**: All items are returned
- **Verification**: Check that all items are returned and that their `matchInfo` properties are set correctly

### Edge Cases

#### 1. Empty Input

**Test: Empty Items Array**

- **Input**: Empty array
- **Filter**: `{ type: "mode" }`
- **Expected**: Empty array is returned
- **Verification**: Check that an empty array is returned

#### 2. Invalid Filters

**Test: Invalid Type**

- **Input**: Various items
- **Filter**: `{ type: "invalid" as MarketplaceItemType }`
- **Expected**: No items are returned (since none match the invalid type)
- **Verification**: Check that an empty array is returned

#### 3. Null or Undefined Values

**Test: Null Subcomponents**

- **Input**: A package with `items: null`
- **Filter**: `{ type: "mode" }`
- **Expected**: The package is not returned (since it has no subcomponents to match)
- **Verification**: Check that the package is not in the returned items

**Test: Undefined Metadata**

- **Input**: A package with subcomponents that have `metadata: undefined`
- **Filter**: `{ type: "mode" }`
- **Expected**: The package is returned if any subcomponents have type "mode"
- **Verification**: Check that the package is returned if appropriate and that subcomponents with undefined metadata are handled correctly

### Performance Tests

#### 1. Large Dataset

**Test: Filter Large Dataset**

- **Input**: A large number of items (e.g., 1000+)
- **Filter**: Various filters
- **Expected**: The filtering completes in a reasonable time
- **Verification**: Measure the time taken to filter the items and ensure it's within acceptable limits

#### 2. Deep Nesting

**Test: Deeply Nested Items**

- **Input**: Items with deeply nested subcomponents
- **Filter**: Various filters
- **Expected**: The filtering correctly handles the nested structure
- **Verification**: Check that the results are correct for deeply nested structures

## Test Organization

The Marketplace tests are organized by functionality rather than by file structure:

### Consolidated Test Files

```
src/services/marketplace/__tests__/
├── Marketplace.consolidated.test.ts  # Combined tests
├── searchUtils.test.ts                  # Search utility tests
└── PackageSubcomponents.test.ts         # Subcomponent tests
```

### Test Structure

Tests are organized into logical groups:

```typescript
describe("Marketplace", () => {
	// Shared setup

	describe("Direct Filtering", () => {
		// Tests for filtering functionality
	})

	describe("Message Handler Integration", () => {
		// Tests for message handling
	})

	describe("Sorting", () => {
		// Tests for sorting functionality
	})
})
```

## Test Coverage

The Marketplace maintains high test coverage:

### Coverage Goals

- **Backend Logic**: 90%+ coverage
- **UI Components**: 80%+ coverage
- **Integration Points**: 85%+ coverage

### Coverage Reporting

```typescript
// jest.config.js
module.exports = {
	// ...other config
	collectCoverage: true,
	coverageReporters: ["text", "lcov", "html"],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 85,
			lines: 85,
			statements: 85,
		},
		"src/services/marketplace/*.ts": {
			branches: 90,
			functions: 90,
			lines: 90,
			statements: 90,
		},
	},
}
```

### Critical Path Testing

Critical paths have additional test coverage:

1. **Search and Filter**: Comprehensive tests for all filter combinations
2. **Message Handling**: Tests for all message types and error conditions
3. **UI Interactions**: Tests for all user interaction flows

## Test Performance

The Marketplace tests are optimized for performance:

### Fast Unit Tests

```typescript
// Fast unit tests with minimal dependencies
describe("containsSearchTerm", () => {
	it("should return true for exact matches", () => {
		expect(containsSearchTerm("hello world", "hello")).toBe(true)
	})

	// More tests...
})
```

### Optimized Integration Tests

```typescript
// Optimized integration tests
describe("Marketplace Integration", () => {
	// Load template data once for all tests
	beforeAll(async () => {
		templateItems = await metadataScanner.scanDirectory(templatePath)
	})

	// Create fresh manager for each test
	beforeEach(() => {
		manager = new MarketplaceManager(mockContext)
		manager["currentItems"] = [...templateItems]
	})

	// Tests...
})
```

### Parallel Test Execution

```typescript
// jest.config.js
module.exports = {
	// ...other config
	maxWorkers: "50%", // Use 50% of available cores
	maxConcurrency: 5, // Run up to 5 tests concurrently
}
```

## Continuous Integration

The Marketplace tests are integrated into the CI/CD pipeline:

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v2

            - name: Setup Node.js
              uses: actions/setup-node@v2
              with:
                  node-version: "16"

            - name: Install dependencies
              run: npm ci

            - name: Run tests
              run: npm test

            - name: Upload coverage
              uses: codecov/codecov-action@v2
              with:
                  file: ./coverage/lcov.info
```

### Pre-commit Hooks

```json
// package.json
{
	"husky": {
		"hooks": {
			"pre-commit": "lint-staged"
		}
	},
	"lint-staged": {
		"*.{ts,tsx}": ["eslint --fix", "jest --findRelatedTests"]
	}
}
```

## Test Debugging

The Marketplace includes tools for debugging tests:

### Debug Logging

```typescript
// Debug logging in tests
describe("Complex integration test", () => {
	it("should handle complex search", async () => {
		// Enable debug logging for this test
		const originalDebug = process.env.DEBUG
		process.env.DEBUG = "marketplace:*"

		// Test logic...

		// Restore debug setting
		process.env.DEBUG = originalDebug
	})
})
```

### Visual Debugging

```typescript
// Visual debugging for UI tests
describe("UI component test", () => {
  it("should render correctly", async () => {
    const { container } = render(<MarketplaceItemCard item={mockItem} />);

    // Save screenshot for visual debugging
    if (process.env.SAVE_SCREENSHOTS) {
      const screenshot = await page.screenshot();
      fs.writeFileSync("./screenshots/item-card.png", screenshot);
    }

    // Test assertions...
  });
});
```

## Test Documentation

The Marketplace tests include comprehensive documentation:

### Test Comments

```typescript
/**
 * Tests the search functionality with various edge cases
 *
 * Edge cases covered:
 * - Empty search term
 * - Case sensitivity
 * - Special characters
 * - Very long search terms
 * - Matching in subcomponents
 */
describe("Search functionality", () => {
	// Tests...
})
```

### Test Scenarios

```typescript
describe("Package filtering", () => {
	/**
	 * Scenario: User filters by type and search term
	 * Given: A list of items of different types
	 * When: The user selects a type filter and enters a search term
	 * Then: Only items of the selected type containing the search term should be shown
	 */
	it("should combine type and search filters", () => {
		// Test implementation...
	})
})
```

---

**Previous**: [UI Component Design](./05-ui-components.md) | **Next**: [Extending the Marketplace](./07-extending.md)
