---
title: Agent skills
description: Install Flying Money as a skill for Claude and other agent platforms, or read it from the web. Three skills, plain text, no scripts.
---

# Agent skills

A **skill** is a folder with a `SKILL.md` that teaches an agent when and how to do something. Flying Money ships three, in
the format used by Claude and other agent platforms. They are plain Markdown: no scripts, no downloads, nothing runs.

| Skill | Use it when |
|---|---|
| `flying-money` | An agent needs to pay a paid API, ask its owner for spending power, or set Flying Money up |
| `flying-money-x402` | The paid site is an ordinary x402 site: pay it through a bridge |
| `flying-money-owner` | You are the owner: approve a request, see where the money is, take it back, check a bridge |

## Install

```bash
npx skills add https://github.com/raldblox/flying-money --skill flying-money
npx skills add https://github.com/raldblox/flying-money --skill flying-money-x402
```

That copies the skill into your agent's skills folder (Claude Code, Cursor and others are detected). Or copy a folder from
[`skills/`](https://github.com/raldblox/flying-money/tree/main/skills) by hand. Read a skill before you install it: they
are short.

## Read them on the web

- `https://useflyingmoney.vercel.app/skill.md`: the main skill, at the site root.
- `https://useflyingmoney.vercel.app/.well-known/skills/index.json`: every skill, with its description and URL.
- `https://useflyingmoney.vercel.app/.well-known/skills/<name>/SKILL.md`: one skill.
- A hosted bridge describes itself too: `https://flying-money-bridge.vercel.app/skill.md`.

## What the skills never do

They never ask an agent for, or reveal, a wallet key or recovery phrase, never claim a budget was approved before it was, and
never tell an agent to pay in a loop. The rules they state are the same ones the contract enforces.

The skills do not replace the MCP server: they tell an agent how to set it up and use it
([agent setup](/agent.md), [MCP tools](/docs/mcp)).
