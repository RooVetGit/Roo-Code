# MySQL MCP Server

A Model Context Protocol (MCP) server that provides MySQL database operations.

## Features

- Execute SELECT queries safely
- Execute INSERT, UPDATE, DELETE, and DDL operations
- List databases and tables
- Describe table structures
- Test database connections
- Connection pooling for efficient resource usage

## Installation

```bash
npm install @roo-code/mcp-server-mysql
```

## Configuration

The MySQL MCP server requires the following environment variables:

- `MYSQL_HOST` - MySQL server host (default: `localhost`)
- `MYSQL_PORT` - MySQL server port (default: `3306`)
- `MYSQL_USER` - MySQL username (default: `root`)
- `MYSQL_PASSWORD` - MySQL password (default: empty string)
- `MYSQL_DATABASE` - Default database to use (optional)

## Available Tools

### `query`

Execute SELECT queries on the MySQL database.

**Parameters:**

- `query` (string, required): The SELECT query to execute
- `database` (string, optional): Database to use (overrides default)

**Example:**

```json
{
	"query": "SELECT * FROM users WHERE active = 1",
	"database": "myapp"
}
```

### `execute`

Execute non-SELECT queries (INSERT, UPDATE, DELETE, CREATE, etc.).

**Parameters:**

- `query` (string, required): The SQL query to execute
- `database` (string, optional): Database to use (overrides default)

**Example:**

```json
{
	"query": "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
	"database": "myapp"
}
```

### `list_databases`

List all databases in the MySQL server.

**No parameters required.**

### `list_tables`

List all tables in a specific database.

**Parameters:**

- `database` (string, required): The database name

**Example:**

```json
{
	"database": "myapp"
}
```

### `describe_table`

Get the structure of a table.

**Parameters:**

- `table` (string, required): The table name
- `database` (string, optional): The database name (uses default if not specified)

**Example:**

```json
{
	"table": "users",
	"database": "myapp"
}
```

### `test_connection`

Test the MySQL connection and get server information.

**No parameters required.**

## Usage with Roo Code

To use this MCP server with Roo Code, add it to your MCP settings configuration:

```json
{
	"mcpServers": {
		"mysql": {
			"command": "node",
			"args": ["path/to/@roo-code/mcp-server-mysql/dist/index.js"],
			"env": {
				"MYSQL_HOST": "localhost",
				"MYSQL_PORT": "3306",
				"MYSQL_USER": "your_username",
				"MYSQL_PASSWORD": "your_password",
				"MYSQL_DATABASE": "your_default_db"
			}
		}
	}
}
```

## Security Considerations

- The `query` tool only allows SELECT, SHOW, and DESCRIBE queries
- The `execute` tool is for all other operations (INSERT, UPDATE, DELETE, etc.)
- Always use parameterized queries when building dynamic SQL
- Ensure proper access controls are in place at the MySQL server level
- Store credentials securely and never commit them to version control

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

MIT
