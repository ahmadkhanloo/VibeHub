# Getting started with Claude Desktop and Code

## Install and open Code

[Install Claude Desktop from its official site](https://claude.com/download). Refresh VibeHub and, if necessary, select Claude.exe. Open Claude, sign in, choose the Code tab and a project folder, and enter your request. Review proposed edits and commands before approving them. Code availability depends on your account plan and Anthropic terms. [Desktop documentation](https://code.claude.com/docs/en/desktop).

## Other APIs and models

Using another provider in the desktop Code tab depends on organizational configuration and Anthropic support. Selecting an API in VibeHub does not automatically connect it to Claude. Anthropic documents gateway and Vertex configuration for enterprise deployments; use the Claude Code CLI for Bedrock and Foundry. [Desktop documentation](https://code.claude.com/docs/en/desktop).

For a third-party route to non-Claude models in the CLI, see the [Claude Code and LiteLLM guide](https://github.com/ahmadkhanloo/VibeHub/blob/main/docs/tutorials/claude-code/en.md). Configure a limited gateway key, gateway URL, and model in a PowerShell session; test streaming and tool calls separately. This route does not guarantee model compatibility or desktop support. Keep keys out of repositories and error reports.
