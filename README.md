# cc-impact

> What did you actually build with Claude Code?

`cc-session-stats` tells you how many hours you spent.
`cc-impact` tells you what those hours produced: **commits, lines written, files changed**.

```
  cc-impact v1.0.0
  ═══════════════════════════════════════
  What did you actually build? Last 30 days.

  ▸ Output (last 30 days)
    Commits:       563
    Lines added:  +398,448
    Lines removed: -93,371
    Net lines:    +305,077
    Files changed: 6,876
    Active repos:  28

  ▸ Most Active Repos (top 10)
    spell-cascade           ███████████████  276 commits  +125.4k
    nursery-shift           ████             72 commits  +41.0k
    dung-azure-flame        ███              40 commits  +94.5k
    ...

  ▸ Pace
    18.8 commits/day  |  +10,169 net lines/day

  Pair with npx cc-session-stats to see hours → this is what those hours built.
```

## Usage

```bash
npx cc-impact              # Last 30 days
npx cc-impact --days=7    # Last week
npx cc-impact --days=90   # Last quarter
npx cc-impact --json      # JSON output for piping
```

## What it scans

Searches for git repos under:
- `~/projects/`
- `~/aetheria/`
- `~/draemorth/`

Only repos with commits in the selected time range are shown.

## The full picture

```
npx cc-session-stats    →  140 hours with Claude Code
npx cc-impact           →  563 commits, +305k net lines, 28 repos
                           That's 18.8 commits/day, +10k lines/day
```

## Part of cc-toolkit

One of [30 free tools](https://yurukusa.github.io/cc-toolkit/) for understanding your Claude Code usage.

## License

MIT
