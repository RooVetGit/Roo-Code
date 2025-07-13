#!/usr/bin/env node

/**
 * Basic validation script for Playwright MCP YAML template
 * Validates the YAML structure and schema compliance
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple validation function - in production you'd want to import the actual schemas
function validatePlaywrightTemplate() {
  try {
    // Path to the YAML template
    const templatePath = path.join(__dirname, '../playwright-mcp-integration/playwright-mcp.yaml');
    
    console.log('🔍 Validating Playwright MCP template...');
    console.log(`📁 Template path: ${templatePath}`);
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Template file not found at:', templatePath);
      process.exit(1);
    }
    
    // Read and parse YAML
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const parsedTemplate = yaml.parse(templateContent);
    
    // Basic structure validation
    if (!parsedTemplate || typeof parsedTemplate !== 'object') {
      console.error('❌ Invalid YAML structure');
      process.exit(1);
    }
    
    if (!parsedTemplate.items || !Array.isArray(parsedTemplate.items)) {
      console.error('❌ Missing or invalid items array');
      process.exit(1);
    }
    
    if (parsedTemplate.items.length === 0) {
      console.error('❌ No items found in template');
      process.exit(1);
    }
    
    // Validate the first (and expected only) item
    const mcpItem = parsedTemplate.items[0];
    
    // Check required fields
    const requiredFields = ['id', 'type', 'name', 'description', 'url', 'content'];
    for (const field of requiredFields) {
      if (!mcpItem[field]) {
        console.error(`❌ Missing required field: ${field}`);
        process.exit(1);
      }
    }
    
    // Validate type
    if (mcpItem.type !== 'mcp') {
      console.error(`❌ Invalid type. Expected 'mcp', got '${mcpItem.type}'`);
      process.exit(1);
    }
    
    // Validate content structure
    if (!Array.isArray(mcpItem.content)) {
      console.error('❌ Content must be an array of installation methods');
      process.exit(1);
    }
    
    // Validate each installation method
    for (let i = 0; i < mcpItem.content.length; i++) {
      const method = mcpItem.content[i];
      
      if (!method.name || !method.content) {
        console.error(`❌ Installation method ${i + 1} missing name or content`);
        process.exit(1);
      }
      
      // Validate JSON content
      try {
        const parsedContent = JSON.parse(method.content);
        if (!parsedContent.command || !parsedContent.args) {
          console.error(`❌ Installation method '${method.name}' missing command or args`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Invalid JSON in installation method '${method.name}':`, error.message);
        process.exit(1);
      }
    }
    
    // Validate URL format
    try {
      new URL(mcpItem.url);
    } catch (error) {
      console.error(`❌ Invalid URL format: ${mcpItem.url}`);
      process.exit(1);
    }
    
    console.log('✅ Template validation passed!');
    console.log(`📋 Found ${mcpItem.content.length} installation methods`);
    console.log(`🔗 URL: ${mcpItem.url}`);
    console.log(`👤 Author: ${mcpItem.author || 'Not specified'}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validatePlaywrightTemplate();
}

export { validatePlaywrightTemplate };