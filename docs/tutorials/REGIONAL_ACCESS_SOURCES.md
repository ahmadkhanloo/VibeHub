# Regional access and Claude Code source notes

Reviewed 2026-11-01. This is documentation research, not a network, account, billing, installation or legal assessment.

Additional primary sources checked: [ChatGPT supported countries](https://help.openai.com/en/articles/7947663-chatgpt-supported-countries) and [Antigravity FAQ geographic availability](https://antigravity.google/docs/faq). Iran is absent from both observed lists. These findings apply to the named host services, not to every plugin, open-source skill or local document tool. Tutorials explicitly separate network workarounds from account eligibility. No direct access from Iran was tested.

| Official source | Observation | Editorial limit |
| --- | --- | --- |
| [Anthropic supported regions](https://www.anthropic.com/legal/supported-regions) | `supported-countries` redirected here; displayed effective date November 12, 2026; Iran absent from the displayed list. | Future-effective relative to this review. Do not present that policy as already in force or infer today's exact eligibility. Catalog uses `review_terms`, not a confirmed restriction test. |
| [Claude Code setup](https://code.claude.com/docs/en/setup) | Windows installation, WinGet and version verification documented. | Local installation and launch were not performed. |
| [Other LLM gateways](https://code.claude.com/docs/en/llm-gateway) | Anthropic explicitly excludes support for non-Claude routing through gateways. | A third-party routing guide is not an Anthropic compatibility endorsement. |
| [Gateway connection](https://code.claude.com/docs/en/llm-gateway-connect) | Base URL, credentials and `/status` checks documented. | A configuration or label does not prove live upstream traffic. |
| [LiteLLM Claude Code client](https://docs.litellm.ai/docs/proxy/client_setup/claude_code) | Virtual-key configuration and model aliases documented. | LiteLLM is the owning source for its integration claim. |
| [LiteLLM alternate models](https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models) | Provider translation and self-hosted configuration documented. | Actual tool compatibility, quotas and provider eligibility require separate checks. |

Network reachability, account eligibility and provider billing are separate questions. A proxy can change a route; a model gateway can translate requests. Neither establishes permission to use a restricted service. Do not generalize a vendor policy to all apps, or call every connection failure a sanction. No credentials were collected, no authentication was attempted, and no external service was modified for this documentation.
