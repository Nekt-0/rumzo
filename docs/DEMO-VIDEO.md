# Terminal demo

The [MP4 walkthrough](../assets/demos/rumzo-demo.mp4) shows two synthetic receipts from `src/demo/session.ts` and the result of RUMZO's comparison function. The repository, token address, blocks, revisions and contract values belong to the built-in example. The visible DEMO label stays on screen.

## Run it

After installing dependencies and building the project:

```sh
pnpm demo:terminal
```

The command prints six stages over approximately 20 seconds, then exits. It does not call providers, inspect external repositories, trade or write receipts to live history. Use a terminal at least 96 columns wide. ANSI colors and screen redraws are enabled for a terminal; plain redirected output contains each stage sequentially.

`--instant` omits presentation delays. `--color` forces ANSI output for recording. All observations and differences come from the shared demo fixtures and comparison code.

## Video production

The video captures the command's actual output and presents each stage in a readable terminal frame. A brief typed-command introduction, the RUMZO mascot and final holding time were added for presentation. This is an edited terminal demonstration, not a live-chain recording. It has no soundtrack or voiceover.

Format: H.264 MP4, 1920 × 1080, 30 fps, with fast-start playback. The poster is the final stage. The video and poster use only RUMZO assets and output.
