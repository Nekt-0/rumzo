# Tests

Run pnpm run check for compilation and tests, or pnpm run test:coverage after building for Node's coverage report. Provider fixtures keep the suite deterministic and offline.

| Test file | Behavior exercised |
| --- | --- |
| input.test.mjs | Repository forms; rejected alternate hosts, credentials, traversal and invalid addresses |
| classification.test.mjs | Source, test, documentation and generated-file categories |
| github-client.test.mjs | HTTP errors, response-size bound, redirect policy and malformed JSON |
| github.test.mjs | Revision pinning, README association, partial trees and private-repository refusal |
| chain.test.mjs | Wrong-network refusal, block pinning and unknown values |
| comparison.test.mjs | File changes, missing coverage, chronology and contract-value comparisons |
| markdown.test.mjs | Export structure and escaping untrusted metadata |
| storage.test.mjs | Round trips, invalid IDs and damaged-file isolation |
| monitoring.test.mjs | Persistent watches, due schedules, receipt comparison and Telegram change alerts |
| server.test.mjs | Scan/save/export/compare HTTP flow, Host and Origin validation |
| demo.test.mjs | Deterministic walkthrough, live-data isolation, exports and static-asset allowlist |
| cli.test.mjs | Help, malformed options and invalid command handling |

The tests validate RUMZO's behavior, not third-party repository functionality or token safety. Passing fixtures do not establish that a public RPC endpoint is currently available.

## Visual checks

1. Start with an empty receipt directory and check the landing page.
2. Select Explore demo and verify the synthetic-data notice.
3. Inspect both evidence panels and the comparison.
4. Change the comparison baseline, export JSON/Markdown, and verify the demo never enters live history.
5. Check a narrow mobile viewport for clipping or horizontal overflow.

Screenshots are stored under assets/screenshots and referenced near the top of the README.
