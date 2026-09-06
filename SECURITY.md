# Security model

RUMZO v0.1 is a local read-only research tool. It does not hold wallet keys, sign messages, submit transactions, install repository dependencies or run inspected code. It does not provide a contract audit.

GitHub input is restricted to a repository on `github.com`. The HTTP client uses a fixed `api.github.com` origin, rejects redirects, applies a response-size limit and timeouts, and pins content reads to a SHA. Manifests and READMEs are treated as data. Text from upstream is rendered using DOM text nodes, not HTML.

The web server listens on loopback only, checks the Host and Origin, caps inspection request size and concurrency, and sends a restrictive Content Security Policy. There is no user authentication or public-service rate limiting; do not expose it through a public tunnel or reverse proxy without adding those controls.

The RPC endpoint is configured by the operator through an environment variable. RUMZO checks chain ID 4663 before token reads. A failed read is unknown. RPC exception details are not copied into reports because they may contain provider credentials.

Local reports contain public on-chain and GitHub observations, but the set of projects someone chooses to research can itself be sensitive. Reports are stored locally and exported only by user action. They are not uploaded by the app.

For vulnerabilities, use GitHub private vulnerability reporting if it is enabled on the repository, or contact the maintainer privately. Do not put credentials or a working exploit against someone else's live system in a public issue.
