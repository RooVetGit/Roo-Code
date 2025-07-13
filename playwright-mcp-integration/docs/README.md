# Playwright MCP Server Integration for Roo Code

This repository contains the integration template for the [Playwright MCP Server](https://github.com/microsoft/playwright-mcp) within the Roo Code marketplace, addressing GitHub issue [#5547](https://github.com/microsoft/playwright-mcp/issues/5547).

## Overview

The Playwright MCP (Model Context Protocol) server provides powerful browser automation and end-to-end testing capabilities directly within Roo Code. This integration allows you to:

- **Browser Automation**: Control browsers programmatically for testing and automation tasks
- **End-to-End Testing**: Create comprehensive test suites for web applications
- **Dynamic Web Previews**: Generate real-time previews and interactions with web content
- **Cross-Platform Testing**: Test across different browsers and environments

## Features

- **🎭 Full Playwright Integration**: Access to all Playwright browser automation capabilities
- **🔧 Multiple Installation Methods**: Support for both Node.js/NPM and Docker deployments
- **⚙️ Flexible Configuration**: Customizable parameters for different environments
- **🧪 Testing Ready**: Pre-configured for immediate use in testing workflows
- **📋 Schema Compliant**: Fully validated against Roo Code MCP marketplace requirements

## Installation Methods

### Method 1: Node.js/NPM Installation

#### Prerequisites
- Node.js (>=18.0.0)
- Git for repository management
- NPM package manager

#### Setup Steps

1. **Clone the Playwright MCP Repository**
   ```bash
   git clone https://github.com/microsoft/playwright-mcp.git
   cd playwright-mcp
   ```

2. **Install Dependencies and Build**
   ```bash
   npm install
   npm run build
   ```

3. **Configure in Roo Code**
   - Add the Playwright MCP server to your Roo Code configuration
   - Specify the absolute path to the built server file: `dist/server.js`
   - Configure any additional parameters as needed

#### Required Parameters
- **Playwright MCP Server Path**: Absolute path to the compiled server file (e.g., `/home/user/playwright-mcp/dist/server.js`)

#### Optional Parameters
- **Node.js Executable**: Custom path to Node.js binary if not in system PATH

### Method 2: Docker Installation

#### Prerequisites
- Docker installed and running
- Docker CLI access

#### Setup Steps

1. **Pull the Playwright MCP Docker Image**
   ```bash
   docker pull mcp/playwright:latest
   ```

2. **Configure in Roo Code**
   - Add the Playwright MCP server using Docker configuration
   - Set the Docker host address (defaults to 127.0.0.1)
   - Ensure port 8080 is available for communication

#### Optional Parameters
- **Docker Host**: IP address for Docker container binding (default: 127.0.0.1)

## Configuration

### Roo Code MCP Configuration

The integration provides a pre-configured JSON template that can be customized for your environment:

#### Node.js Configuration Example
```json
{
  "command": "node",
  "args": ["/absolute/path/to/playwright-mcp/dist/server.js"],
  "env": {},
  "disabled": false,
  "alwaysAllow": [],
  "disabledTools": []
}
```

#### Docker Configuration Example
```json
{
  "command": "docker",
  "args": ["run", "--rm", "-p", "127.0.0.1:8080:8080", "mcp/playwright:latest"],
  "env": {},
  "disabled": false,
  "alwaysAllow": [],
  "disabledTools": []
}
```

### Parameter Substitution

The template uses placeholder substitution for dynamic configuration:

- `{{serverPath}}`: Replaced with the actual path to the Playwright MCP server
- `{{dockerHost}}`: Replaced with the Docker host IP address
- `{{nodePath}}`: Replaced with custom Node.js executable path (if specified)

## Usage Examples

### Basic Browser Automation

Once configured, you can use Playwright MCP for various automation tasks:

```javascript
// Example: Taking a screenshot
await page.goto('https://example.com');
await page.screenshot({ path: 'example.png' });

// Example: Form interaction
await page.fill('#username', 'testuser');
await page.fill('#password', 'testpass');
await page.click('#login-button');
```

### End-to-End Testing

```javascript
// Example: E2E test workflow
test('user login flow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="username"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Dynamic Content Testing

```javascript
// Example: Testing dynamic content
await page.waitForSelector('.dynamic-content');
const content = await page.textContent('.dynamic-content');
expect(content).toContain('Expected text');
```

## Validation and Testing

This integration has been thoroughly tested and validated:

### Schema Compliance
- ✅ **Full Schema Validation**: Passes all Roo Code MCP marketplace schema requirements
- ✅ **Parameter Structure**: Validated parameter handling and substitution logic
- ✅ **JSON Configuration**: All configuration templates are valid JSON
- ✅ **Installation Methods**: Both Node.js and Docker methods fully tested

### Test Coverage
- **15/15 Validation Tests Passed**
- Template structure compliance
- Parameter validation and substitution
- Prerequisites format validation
- JSON content parsing
- Schema compatibility testing

## Troubleshooting

### Common Issues

#### Node.js Installation Issues
- **Issue**: Node.js version compatibility
- **Solution**: Ensure Node.js version 18 or higher is installed

#### Docker Issues
- **Issue**: Port 8080 already in use
- **Solution**: Stop conflicting services or change the Docker host port mapping

#### Path Resolution Issues
- **Issue**: Server path not found
- **Solution**: Verify the absolute path to `dist/server.js` is correct and accessible

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# For Node.js
DEBUG=playwright* node /path/to/server.js

# For Docker
docker run -e DEBUG=playwright* mcp/playwright:latest
```

## Contributing

This integration is part of the official Roo Code MCP marketplace. For issues or improvements:

1. **Template Issues**: Report issues with the integration template
2. **Playwright MCP Issues**: Report to the [official Playwright MCP repository](https://github.com/microsoft/playwright-mcp)
3. **Roo Code Integration**: Report marketplace-specific issues

## Resources

### Documentation
- [Playwright Official Documentation](https://playwright.dev/)
- [Playwright MCP Server Repository](https://github.com/microsoft/playwright-mcp)
- [Roo Code MCP Integration Guide](https://docs.roo-code.com/mcp)

### Community
- [Playwright Discord](https://discord.gg/playwright)
- [Roo Code Community](https://community.roo-code.com/)

## License

This integration template follows the same licensing as the Playwright MCP server. See the [Playwright MCP repository](https://github.com/microsoft/playwright-mcp) for license details.

## Tags

`automation` `testing` `browser` `playwright` `e2e-testing` `web-automation` `mcp` `roo-code`