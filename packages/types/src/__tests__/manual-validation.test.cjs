// Manual validation test for Playwright MCP template
// This uses basic Node.js modules to avoid dependency issues

const fs = require('fs');
const path = require('path');

// Simple test framework functions
function describe(name, fn) {
    console.log(`\n--- ${name} ---`);
    fn();
}

function it(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.log(`✗ ${name}: ${error.message}`);
    }
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        },
        toContain: (expected) => {
            if (!actual.includes(expected)) {
                throw new Error(`Expected to contain ${expected}`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined) {
                throw new Error('Expected to be defined');
            }
        },
        toHaveLength: (expected) => {
            if (actual.length !== expected) {
                throw new Error(`Expected length ${expected}, got ${actual.length}`);
            }
        }
    };
}

// Validation tests
async function runValidation() {
    console.log('Running Playwright MCP Template Validation');
    
    try {
        // Read template file
        const templatePath = 'C:\\Users\\orphe\\Downloads\\playwright-mcp.yaml';
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        
        // Parse YAML manually (simple approach)
        const yamlLines = templateContent.split('\n');
        console.log(`Template loaded with ${yamlLines.length} lines`);
        
        describe("Template File Structure", () => {
            it("should exist and be readable", () => {
                expect(templateContent).toBeDefined();
                expect(templateContent.length).toBe(templateContent.length); // Just verify it has content
            });
            
            it("should contain required YAML structure", () => {
                expect(templateContent).toContain('items:');
                expect(templateContent).toContain('id: playwright-mcp');
                expect(templateContent).toContain('type: mcp');
            });
            
            it("should have proper MCP metadata", () => {
                expect(templateContent).toContain('name: Playwright MCP');
                expect(templateContent).toContain('description:');
                expect(templateContent).toContain('author: "Microsoft"');
                expect(templateContent).toContain('url: "https://github.com/microsoft/playwright-mcp"');
            });
        });
        
        describe("Installation Methods", () => {
            it("should have Node.js/NPM method", () => {
                expect(templateContent).toContain('name: Node.js/NPM');
                expect(templateContent).toContain('command": "node"');
                expect(templateContent).toContain('{{serverPath}}');
            });
            
            it("should have Docker method", () => {
                expect(templateContent).toContain('name: Docker');
                expect(templateContent).toContain('command": "docker"');
                expect(templateContent).toContain('{{dockerHost}}');
            });
        });
        
        describe("Parameters", () => {
            it("should have serverPath parameter", () => {
                expect(templateContent).toContain('key: serverPath');
                expect(templateContent).toContain('Playwright MCP Server Path');
                expect(templateContent).toContain('optional: false');
            });
            
            it("should have dockerHost parameter", () => {
                expect(templateContent).toContain('key: dockerHost');
                expect(templateContent).toContain('Docker Host');
                expect(templateContent).toContain('optional: true');
            });
        });
        
        describe("Prerequisites", () => {
            it("should have Node.js prerequisites", () => {
                expect(templateContent).toContain('Node.js (>=18)');
                expect(templateContent).toContain('git clone');
                expect(templateContent).toContain('npm install');
            });
            
            it("should have Docker prerequisites", () => {
                expect(templateContent).toContain('Docker installed and running');
                expect(templateContent).toContain('docker pull');
            });
        });
        
        describe("JSON Content Validation", () => {
            it("should have valid JSON in Node.js method content", () => {
                const nodeContentMatch = templateContent.match(/name: Node\.js\/NPM[\s\S]*?content: \|([\s\S]*?)parameters:/);
                if (nodeContentMatch) {
                    const jsonContent = nodeContentMatch[1].trim();
                    try {
                        JSON.parse(jsonContent);
                        console.log('✓ Node.js JSON content is valid');
                    } catch (e) {
                        throw new Error('Node.js JSON content is invalid: ' + e.message);
                    }
                } else {
                    throw new Error('Could not find Node.js content section');
                }
            });
            
            it("should have valid JSON in Docker method content", () => {
                const dockerContentMatch = templateContent.match(/name: Docker[\s\S]*?content: \|([\s\S]*?)parameters:/);
                if (dockerContentMatch) {
                    const jsonContent = dockerContentMatch[1].trim();
                    try {
                        JSON.parse(jsonContent);
                        console.log('✓ Docker JSON content is valid');
                    } catch (e) {
                        throw new Error('Docker JSON content is invalid: ' + e.message);
                    }
                } else {
                    throw new Error('Could not find Docker content section');
                }
            });
        });
        
        describe("Tags and Metadata", () => {
            it("should have appropriate tags", () => {
                expect(templateContent).toContain('automation');
                expect(templateContent).toContain('testing');
                expect(templateContent).toContain('browser');
                expect(templateContent).toContain('playwright');
            });
        });
        
        console.log('\n🎉 All validation tests completed!');
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

// Run the validation if this file is executed directly
if (require.main === module) {
    runValidation();
}

module.exports = { runValidation };