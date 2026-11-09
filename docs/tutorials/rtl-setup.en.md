# Set up RTL after installing a coding app

[فارسی](rtl-setup.fa.md)

## Install and detect the app

Install Qoder, ZCode, DeepSeek Harness, or standalone Antigravity from its official source. Return to VibeHub; the inventory refreshes on returning after five seconds. You can also choose **Check again** on Apps. A detected app receives its own tile.

## Set up RTL from the tile

Choose **Set up RTL** on the app tile and confirm. VibeHub uses its bundled adapter and private Node runtime to create the app's RTL shortcut under **Start → VibeHub** and saves RTL for the next launch from the workspace. Setup does not run or close the app, download another runtime, change vendor files, or change the app's accounts.

If the required payload is missing, install the full VibeHub package from the linked official releases page and check again. A successful app installation alone does not provide the VibeHub adapter.

## Launch and change modes

Fully quit an app already running without RTL, including its tray process, before using **Run RTL** or the Start Menu shortcut. The launch-mode button beside Run lets you select normal launch again. To remove the shortcut, delete only that app's RTL shortcut under Start → VibeHub. Repeating setup recreates the same owned shortcut and refuses to overwrite an unrelated shortcut.

## Antigravity support

Standalone Antigravity chat RTL is experimental and is separate from Antigravity IDE. Setup is available on its tile and app page. Mixed-language chat rendering in a real signed-in conversation still needs live compatibility verification; setup success proves shortcut creation, not a working vendor conversation.

## AI connections

Open **AI connections** and select a provider in the searchable grid to see its suggested address and saved connections. Filter to saved entries or **My notes**; notes are local plain text and can be edited from the provider or notes list. Keys are stored separately in the operating system credential vault.

To try an OpenAI-compatible endpoint, choose **Try a custom URL**, enter its base URL and, when needed, an API key. Select **Get models** or enter a model ID and confirm **Test connection**. Listing and testing do not save the connection; choose **Save connection** separately. A model test sends a real request and may consume quota. Use HTTPS, or HTTP for localhost; URLs with embedded credentials, queries, or fragments are rejected. Cloudflare Workers AI requires an account ID and links to its official model list.

Select or copy a saved entry and configure it manually inside the coding app. The separate Proxy page configures requests for the next app launch; saving an API entry does not configure that app automatically. Free/paid status can be unknown and should be checked against current provider terms.
