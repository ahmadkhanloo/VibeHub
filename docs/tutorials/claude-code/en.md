# Claude Code + LiteLLM — from first run to model routing

![Educational workflow schematic](../../../apps/desktop/public/tutorials/claude-code.svg)

Documentation checked: **2026-11-01**. This is a setup guide, not a successful local installation or live routing test.

## 1. Understand the two tools

Claude Code is the coding client in your terminal. LiteLLM is a separate model gateway: **Claude Code → LiteLLM → model provider**. It translates requests and manages routing. A network proxy instead helps transport traffic; it does not translate model APIs.

Anthropic documents gateways but explicitly does **not support routing to non-Claude models**. LiteLLM documents that third-party path. Do not read this as guaranteed compatibility with every model: tool calls, streaming, context limits and reasoning behavior need testing. [Anthropic gateway documentation](https://code.claude.com/docs/en/llm-gateway), [LiteLLM alternate-model tutorial](https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models).

## 2. Install the Windows client

Open PowerShell. Review the current [official setup instructions](https://code.claude.com/docs/en/setup), then use its WinGet option:

```powershell
winget install Anthropic.ClaudeCode
```

Reopen the terminal and check:

```powershell
claude --version
```

Install Git for Windows if you want the Bash tool. Work in a disposable project first. For direct Claude access, follow the official authentication flow only if your account and region are eligible. The gateway route below uses gateway credentials instead.

## 3. Prepare LiteLLM separately

For beginners, ask the gateway operator for its URL, an allowed model alias and a limited virtual key. No provider key belongs in your repository. For self-hosting, follow the [LiteLLM alternate-model tutorial](https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models): install the proxy, configure a `model_list` mapping a stable alias such as `coding-model` to the provider's real model ID, and supply the provider key through the server environment. Configure authentication and restrict network exposure before connecting clients. Provider access and billing remain separate.

## 4. Connect this PowerShell session

Use a trusted HTTPS gateway; `http://localhost:4000` is only an example for your own local gateway. Replace the URL and alias. Read the virtual key without placing it in shell history:

```powershell
$env:ANTHROPIC_BASE_URL = 'https://gateway.example.com'
$gatewayCredential = Read-Host 'Gateway virtual key' -AsSecureString
$env:ANTHROPIC_AUTH_TOKEN = [System.Net.NetworkCredential]::new('', $gatewayCredential).Password
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
$env:ANTHROPIC_MODEL = 'coding-model'
claude
```

These variables affect this session and its child processes. Close it to discard them. The base URL is the gateway root, not an OpenAI `/v1/chat/completions` endpoint. The alias must exist and be allowed for your key. [LiteLLM client setup](https://docs.litellm.ai/docs/proxy/client_setup/claude_code).

## 5. Verify before trusting it

Run `/status` and check the base URL and credential source. Ask it to explain a small file, then request a harmless edit and inspect the diff. Check gateway logs for the actual upstream model, usage and cost; a client model label alone is insufficient. [Connection verification](https://code.claude.com/docs/en/llm-gateway-connect).

If authentication fails, check expired credentials and conflicting login settings. If the model is missing, check the gateway alias and key permissions. If basic chat works but editing fails, test tool calling and streaming for that exact client/gateway/model combination. Do not persist a failing setup or paste keys into bug reports. VibeHub launch, live proxy routing and Persian terminal rendering are unverified; no app-specific RTL support is offered.

## Iran: connectivity and service eligibility

Restricted services may require a connectivity workaround or proxy, but that does not make an account region eligible or guarantee service. This statement does not mean every catalog app is sanctioned. Iran is absent from Anthropic's observed region list; however, the [page](https://www.anthropic.com/legal/supported-regions) displays **November 12, 2026** as its effective date, later than this review. Check the policy effective on your usage date and the chosen upstream provider's rules. Neither LiteLLM nor a proxy removes those conditions. No Iran network test was performed.
