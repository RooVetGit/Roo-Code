const { TextDocument } = require('vscode-languageserver-textdocument');
const { createConnection, TextDocuments, ProposedFeatures } = require('vscode-languageserver/node');
const ts = require('typescript');
const fs = require('fs/promises');
const path = require('path');

async function decoupleFile(inputFilePath) {
    // Read the source file
    const sourceCode = await fs.readFile(inputFilePath, 'utf-8');
    
    // Create output directory
    const outputDir = path.join(path.dirname(inputFilePath), 'decoupled');
    await fs.mkdir(outputDir, { recursive: true });

    // Parse the source file
    const sourceFile = ts.createSourceFile(
        inputFilePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
    );

    // Store different sections
    const sections = new Map();
    
    // Visit nodes and collect classes and major sections
    function visit(node) {
        if (ts.isClassDeclaration(node) && node.name) {
            // Handle classes
            const className = node.name.text;
            const classCode = sourceCode.substring(node.pos, node.end);
            sections.set(`${className}.js`, classCode);
        } 
        else if (ts.isFunctionDeclaration(node) && node.name) {
            // Handle named functions
            const functionName = node.name.text;
            const functionCode = sourceCode.substring(node.pos, node.end);
            sections.set(`${functionName}.js`, functionCode);
        }
        else if (ts.isVariableStatement(node)) {
            // Handle major variable declarations
            const declarations = node.declarationList.declarations;
            for (const decl of declarations) {
                if (decl.name && ts.isIdentifier(decl.name)) {
                    const varName = decl.name.text;
                    const varCode = sourceCode.substring(node.pos, node.end);
                    sections.set(`${varName}.js`, varCode);
                }
            }
        }
        
        ts.forEachChild(node, visit);
    }

    // Start the visitor pattern
    visit(sourceFile);

    // Create index.js to re-export everything
    let indexContent = '';

    // Write sections to files
    for (const [filename, content] of sections) {
        const filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, content);
        
        // Add to index.js
        const moduleName = path.basename(filename, '.js');
        indexContent += `const { ${moduleName} } = require('./${filename}');\n`;
    }

    // Export all modules in index.js
    indexContent += '\nmodule.exports = {\n';
    for (const [filename] of sections) {
        const moduleName = path.basename(filename, '.js');
        indexContent += `    ${moduleName},\n`;
    }
    indexContent += '};\n';

    await fs.writeFile(path.join(outputDir, 'index.js'), indexContent);

    // Create package.json
    const packageJson = {
        name: "decoupled-extension",
        version: "1.0.0",
        description: "Decoupled version of extension.js",
        main: "index.js",
        dependencies: {
            "vscode-languageserver": "^8.0.0",
            "vscode-languageserver-textdocument": "^1.0.8",
            "typescript": "^4.9.0"
        }
    };

    await fs.writeFile(
        path.join(outputDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
}

// Function to analyze code sections using LSP
async function analyzeSections(document) {
    const connection = createConnection(ProposedFeatures.all);
    const documents = new TextDocuments(TextDocument);
    
    documents.listen(connection);
    connection.listen();

    // Add LSP-specific analysis here if needed
    // This can be extended to use LSP features for better code understanding
}

// Main execution
async function main() {
    const inputFile = process.argv[2] || 'extension.js';
    
    try {
        await decoupleFile(inputFile);
        console.log('Successfully decoupled the file into separate modules!');
    } catch (error) {
        console.error('Error decoupling file:', error);
    }
}

main();