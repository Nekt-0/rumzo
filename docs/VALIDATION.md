# Validation record

Validation commands and coverage are described in [TESTING.md](TESTING.md).

The current revision is validated with a TypeScript build and offline tests. The demo uses deterministic synthetic reports and the same comparison and rendering code used by live inspections. Demo export files can be regenerated with pnpm run demo:export.

UI screenshots are captured from the local application. They show the clean starting state, the explicitly labelled demo receipt and its comparison. They are not generated mockups or live-chain attestations.

Remote CI results belong to their specific commit. See the repository's Actions page rather than treating an earlier run as validation of new code.
