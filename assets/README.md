# Asset inventory

| File | Purpose | Origin |
| --- | --- | --- |
| avatar.png | Original transparent character used in the app | Original AI-generated illustration |
| avatar-background.png | Square avatar for README, profiles and application hero, 1254 × 1254 | Original character with a simplified opaque green background |
| banner.png | README header and reusable wide banner, 2172 × 724 | Original 3:1 pixel-art banner with a concise GitHub and Robinhood Chain description |
| empty-receipts.png | Empty receipt-history state | New illustration based on the original RUMZO character |
| rumzo-workbench.png | README evidence-workbench illustration | New illustration based on the original RUMZO character |
| mark.svg | Browser favicon and compact receipt mark | Hand-authored SVG |
| receipt.svg | Repository evidence section icon | Hand-authored SVG |
| compare.svg | Comparison section icon | Hand-authored SVG |
| how-it-works.svg | README data-flow overview | Hand-authored SVG |
| terminal-demo.svg | README terminal-style synthetic receipt | Hand-authored SVG |
| social/rumzo-public-evidence.png | 16:9 social card explaining the GitHub + Robinhood Chain receipt flow | Programmatically composed from the project palette and original RUMZO character |
| social/rumzo-web-terminal.png | 16:9 terminal-style card for the public web and CLI | Programmatically composed from the project palette and original RUMZO character |
| social/rumzo-receipt-diff-preview.png | 16:9 social card for the v0.2 receipt-diff roadmap update | Programmatically composed from the project palette and original RUMZO character |
| screenshots/home.png | Clean application start screen | Captured from the running app |
| screenshots/receipt.png | Two evidence panels | Captured with labelled synthetic demo data |
| screenshots/comparison.png | File and contract-value differences | Captured with labelled synthetic demo data |
| demos/rumzo-demo.mp4 | Short terminal tour, 1920 × 1080, 30 fps | Offline demo output and expanded details from shared fixtures, presented with the RUMZO mascot |
| demos/rumzo-demo-poster.png | Final frame of the terminal tour | Rendered from the same command output as the video |

The original avatar and empty-history character retain transparency. The square profile avatar, banner and workbench scene have opaque backgrounds. SVG files use the project palette and contain no scripts or external references. Screenshots show actual UI rendering; demo values are illustrative, not on-chain findings.

The generation prompts are documented in [ASSET-PROMPTS.md](../docs/ASSET-PROMPTS.md). Use the square avatar for profiles and the wide banner for headers; preserve their proportions.
