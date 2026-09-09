# Architecture

~~~mermaid
flowchart LR
  UI[Browser / CLI] --> Input[Input validation]
  Input --> GitHub[GitHub inspector]
  Input --> Chain[Chain inspector]
  GitHub --> Receipt[Evidence receipt]
  Chain --> Receipt
  Receipt --> Store[Local snapshot store]
  Store --> Diff[Snapshot comparison]
  Watch[Persistent watchlist] --> Scheduler[Due-check scheduler]
  Scheduler --> Input
  Diff --> Timeline[Monitoring event timeline]
  Timeline --> Telegram[Optional local Telegram alert]
  Receipt --> Export[JSON / Markdown]
  Demo[Synthetic demo session] --> Renderer[Browser renderer]
  Receipt --> Renderer
~~~

## Providers

src/github/client.ts owns the fixed GitHub API origin, headers, timeout and response-size bound. classify.ts assigns inventory categories. inspect.ts resolves one commit and reads its tree and selected blobs without executing their contents.

src/chain/config.ts identifies the supported network and factory. abi.ts defines the read-only contract surface. client.ts creates the RPC transport. facts.ts preserves the distinction between unknown, zero and false. inspect.ts checks chain identity and pins all calls to one block.

## Reports and persistence

src/reports/inspect.ts runs both providers and records observation time. A failed provider can produce a partial receipt. compare.ts compares matching token/repository pairs in chronological order. markdown.ts exports readable evidence with coverage notes.

src/storage/snapshots.ts stores each live receipt as a local JSON file through a temporary write and rename. IDs are validated before constructing paths. A malformed file is skipped during listing; it must not hide all the other receipts.

src/monitoring stores watchlist state atomically, runs due inspections one at a time, compares each result with the previous receipt and classifies the event. Telegram credentials are optional local environment values. Baseline and unchanged events do not send messages.

## HTTP and browser

src/server/app.ts binds only to loopback, verifies Host and Origin, limits request bodies and concurrent inspections, and serves a fixed set of static files. web/app.js creates text nodes for provider strings. Credentials remain on the server; browser requests use same-origin routes.

The hosted page keeps watchlists, events and receipts in browser storage. Its scheduler checks due entries while the page is open. The local CLI runner provides unattended scheduling. The application serves its PNG illustrations and SVG icons from an explicit asset allowlist. README diagrams and documentation screenshots remain repository assets; they are not arbitrary files exposed by the HTTP server.

## Demo boundary

src/demo/session.ts generates two deterministic, invented receipts. The demo route does not call providers or save data. The demo marker remains in JSON exports; Markdown and UI add a visible label. Storage refuses demo reports, and comparison refuses to mix demo and live reports.
