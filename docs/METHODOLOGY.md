# Evidence methodology

## GitHub

RUMZO resolves the default branch to a commit SHA, then fetches its recursive tree. It retains at most 30,000 file/submodule entries and marks the inventory incomplete if either GitHub truncates the tree or this limit is reached. API responses are limited to 10 MB. It inspects at most six matching manifests, each at most 128 KB, and one root README. Submodules and symlinks are not followed. Git LFS payloads and release binaries are not downloaded.

Files are classified by paths and extensions. Generated directories, lockfiles and minified assets are separated first. Tests and configuration are then distinguished from source and documentation. These are inventory heuristics, not semantic code analysis. Examples or unusable files can count as source. Test files may contain no meaningful assertions.

The latest commit's returned file list is presented with a completeness flag. Recent activity is a sample of up to 20 commits anchored to the pinned SHA, not a lifetime commit count or a quality score.

The README check searches for the exact 40-hex-character token address. A positive result establishes only that this README mentions that address. A negative result covers the inspected root README only. It does not establish that no other document associates the repository with the token.

## Robinhood Chain

The chain adapter supports one published Pons v2 factory on chain 4663. It records a block number and timestamp and supplies that block to every contract read. These reads require the RPC provider to serve the chosen state. The head block is not necessarily finalized; the snapshot warns about reorganization risk.

Factory membership, launch stage, fee recipient, additional tax and built-in buyback are read from `getLaunchedToken`. Base hook settings come from `getLaunchFeePolicy`. Curve settings and locker flags are separate contract reads. Unknown values are distinct from observed zero and false.

Explorer links are navigational evidence links, not immutable historical renderings. Reproduce a value with the saved chain, address, method and block. Reports never imply that an explorer page currently displays the saved block's state.

## Snapshot comparison

Comparisons require the same token and repository and chronological observation times. File changes use blob SHA and mode differences. A new path is an addition only when the baseline inventory is complete; a missing path is a removal only when the new inventory is complete. Unknown or unavailable trees are not treated as empty.

Contract changes are reported only when the field was known in both snapshots and the values differ. A transition from unknown to known is a coverage change, not evidence of a contract mutation. Unchanged snapshots do not prove nothing happened between observations.

## Out of scope

Execution verification, contract-bytecode audits, private repositories, automatic source ownership verification, similarity/plagiarism detection, multi-chain coverage, historical fee revenue, transaction accounting, buyback proof, continuous monitoring, and price predictions are not implemented in v0.2.
