# Security model

RUMZO v0.3 is a read-only research tool with local and hosted interfaces. It does not hold wallet keys, sign messages, submit transactions, install repository dependencies or run inspected code. It does not provide a contract audit.

GitHub input is restricted to a repository on `github.com`. The HTTP client uses a fixed `api.github.com` origin, rejects redirects, applies a response-size limit and timeouts, and pins content reads to a SHA. Manifests and READMEs are treated as data. Text from upstream is rendered using DOM text nodes, not HTML.

The local web server listens on loopback only and checks the Host and Origin. The hosted Worker accepts same-origin inspection requests, caps request size and concurrent work per isolate, and sends a restrictive Content Security Policy. Public provider quotas can temporarily limit availability; the hosted endpoint is intentionally read-only and has no wallet or transaction capability.

The RPC endpoint is configured by the operator through an environment variable. RUMZO checks chain ID 4663 before token reads. A failed read is unknown. RPC exception details are not copied into reports because they may contain provider credentials.

Reports contain public on-chain and GitHub observations, but the set of projects someone chooses to research can itself be sensitive. The local server stores reports, watches and monitoring events in `.rumzo`. The hosted app stores them in that visitor's browser. Inputs are sent to the RUMZO Worker and then to the public GitHub and RPC providers required for the inspection; reports are exported only by user action.

Browser scheduling stops when the page is closed. The unattended monitor runs only where the operator starts the local `watch start` process. Optional Telegram credentials remain environment values in that process. They are not copied into reports, monitoring state, browser storage or error messages.

For vulnerabilities, use GitHub private vulnerability reporting if it is enabled on the repository, or contact the maintainer privately. Do not put credentials or a working exploit against someone else's live system in a public issue.
