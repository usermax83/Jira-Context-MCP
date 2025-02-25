# Jira Context MCP

A Model Context Protocol (MCP) implementation for Jira that allows you to:

- Input a Jira ticket link to fetch issue details and instruct Cursor to fix it
- Retrieve all tickets assigned to you within a specified Jira project 
- Filter Jira issues based on a specific issue type and automatically direct Cursor to resolve them
- Integrate seamlessly with Jira's API for automation and efficiency

## Setup

### Prerequisites

- Node.js 20.17.0 or higher
- A Jira account with API access
- A Jira API token (can be generated at https://id.atlassian.com/manage-profile/security/api-tokens)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/Jira-Context-MCP.git
   cd Jira-Context-MCP
   ```

2. Install dependencies:
   ```bash
   npm install
   # or if you use pnpm
   pnpm install
   ```

3. Create a `.env` file based on the example:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your Jira details:
   ```
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_USERNAME=your-email@example.com
   JIRA_API_TOKEN=your-api-token-here
   HTTP_PORT=3000
   ```

### Build

Build the project with:

```bash
npm run build
# or
pnpm build
```

## Usage

### Starting the Server

Start the HTTP server:

```bash
npm start
# or
pnpm start
```

Or use the CLI mode:

```bash
npm run start:cli
# or
pnpm start:cli
```

### Connecting with Cursor

1. In Cursor, open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "Connect to MCP Server"
3. Select "Connect to MCP Server"
4. Enter the server URL (http://localhost:3000/sse by default)

### Available Tools

Once connected, you can use the following tools in Cursor:

#### 1. Get Jira Issue Details

Use this to fetch detailed information about a specific Jira issue:

```
/get_issue issueKey:PROJECT-123
```

#### 2. Get Assigned Issues

Retrieve issues assigned to you in a specific project:

```
/get_assigned_issues projectKey:PROJECT maxResults:10
```

#### 3. Get Issues by Type

Filter issues by type (Bug, Story, Epic, etc.):

```
/get_issues_by_type issueType:Bug projectKey:PROJECT maxResults:10
```

#### 4. Get Projects

List all available projects:

```
/get_projects
```

#### 5. Get Issue Types

List all available issue types:

```
/get_issue_types
```

## Example Workflows

### Fix a Specific Bug

1. Connect to the Jira MCP server in Cursor
2. Get the issue details:
   ```
   /get_issue issueKey:PROJECT-123
   ```
3. Review the issue details and ask Cursor to fix it:
   ```
   Fix the bug described in PROJECT-123
   ```

### Work on Your Assigned Issues

1. Connect to the Jira MCP server in Cursor
2. Get your assigned issues:
   ```
   /get_assigned_issues projectKey:PROJECT
   ```
3. Ask Cursor to help with one of the issues:
   ```
   Help me solve the first issue in my assigned list
   ```

### Fix All Bugs in a Project

1. Connect to the Jira MCP server in Cursor
2. Get all bug issues:
   ```
   /get_issues_by_type issueType:Bug projectKey:PROJECT
   ```
3. Ask Cursor to help fix them:
   ```
   Help me solve these bugs one by one
   ```

## Development

### Project Structure

- `src/` - Source code
  - `services/` - Jira API service
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `server.ts` - MCP server implementation
  - `index.ts` - Application entry point
  - `cli.ts` - CLI entry point

### Adding New Tools

To add new tools, edit the `src/server.ts` file and add new tool definitions in the `registerTools` method.

## License

MIT 

## Author

Rahul Dey - [@rahulthedevil](https://github.com/rahulthedevil) 