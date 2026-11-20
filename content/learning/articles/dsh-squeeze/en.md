# dsh-squeeze: read long material without filling the chat

Adds one tool to the conversation: `squeeze`. It reads a long web page, a batch of pages, a big text file or a PDF with a helper model you choose and returns only the answer; the material never enters the main context, so its tokens are never paid.

## Install

Shared commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). For this plugin:

```bash
dsh plugin --profile desktop add github:q8atnight/dsh-squeeze
```

## Configuration

In the plugin settings:

- A default model and up to two more helper models from the Harness model list; give each a short nickname (`quick`, `careful`) and a one-line "when to use" note.
- A fixed thinking level per model; the agent cannot change it.
- The size limit comes from that model's context window (default: 80%, the rest left for thinking and the answer).
- An optional fallback switch for when the primary model is unreachable or too small for the material.

## Basic command

The call the agent makes looks like:

```
squeeze  url: https://example.com/report.pdf
         prompt: What is the late-registration penalty? Quote the item number.
```

Instead of `url:` you can pass a text or PDF file path. The status line names the answering model, the time and the source size; failures say what to do next.

## Notes

- The material is sent to the helper model's provider; with fallback enabled it may go to another provider too. Do not send sensitive data.
- Files are read only through the Harness filesystem service; policy-denied paths get `ACCESS DENIED`.
- A PDF with no text layer (a scan) is rejected with `SOURCE PROBLEM` and needs OCR.
- Typical uses: pulling figures from a long report, finding one section in a large log or code file, comparing a few web pages, summarising a transcript.
