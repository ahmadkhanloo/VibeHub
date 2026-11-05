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

## API notebook

The API notebook saves endpoints, model IDs, and optional keys. Optional connection tests send real requests. Select or copy a saved entry and configure it manually inside the coding app. The separate Proxy page configures requests for the next app launch; saving an API entry does not configure that app automatically.
