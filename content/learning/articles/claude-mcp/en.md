# Connect tools with MCP

## Practice

Choose a trusted server and check its installation instructions against Claude documentation. Inspect its status and tools with `/mcp`. Begin with a read-only request.

```text
Read and summarize existing information without changing records.
```

## Connection example

![Adding an HTTP server in PowerShell; the official screenshot shows the same Linear example used below. Obtain each service URL from its own documentation.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-add.webp)

This official example registers Linear. Running it is optional and requires access to that service; complete sign-in through its official flow yourself.

```powershell
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
claude mcp list
```

Check connection status with `/mcp`, then request only the issue list of a test project. Never put a key or token in a prompt. If tools are missing, inspect the URL, authentication and install scope. An active connection is not permission to change all connected data.

## Verify the result

![Windows /mcp list: connected differs from needs authentication; Linear still requires sign-in in this example.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-status.webp)

![The example Dev-utils server details show connection status, tool count, and View tools, Reconnect and Disable actions.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-detail.webp)

Check actual files and test output. If a command is unavailable, check your installed version and the official documentation.

[Claude Code — mcp](https://code.claude.com/docs/en/mcp)

Official illustrated lessons:

- [Claude Academy](https://academy.claude.com/courses/claude-code-101/mcp)
