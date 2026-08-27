# Documentation

Everything written about this project, and where to start depending on what you
are here for.

**Published as a site:** [nizarkenny.github.io/dataroom](https://nizarkenny.github.io/dataroom/).
That is where the design system is readable, because GitHub shows an HTML file as
source rather than as a page.

| | For |
| --- | --- |
| [The repository README](../README.md) | What this is, the demo accounts, running it locally, the data model, how access is resolved, three scaling questions, and what was deliberately not built |
| [The design system](https://nizarkenny.github.io/dataroom/design/style-reference.html) | Tokens in both themes, the type scale, every component in every state, and the rule under each one. The source is [`design/style-reference.html`](design/style-reference.html) |
| [The API](api.md) | Every route, the three kinds of caller, the two step upload, and what each error code means |
| [What comes next](roadmap.md) | Eleven things, sized, ordered by what a deal stalls without |
| [Screenshots](screenshots) | A listing, rows that inherit their access, the share dialog, and what a link holder sees |

## If you have ten minutes

Open the [live application](https://nizar-dataroom.vercel.app) and sign in as
`reader@dataroom.dev` (password `dataroom-demo-2026`). You will land in the one
folder that account was invited to, and everything beside it answers 404. Then
read [how access is resolved](../README.md#how-access-is-resolved), which is the
forty lines that make that true.

## If you are here for the design

Start at [the design system](https://nizarkenny.github.io/dataroom/design/style-reference.html),
then open the [live application](https://nizar-dataroom.vercel.app) as
`demo@dataroom.dev` and walk into `02 Financials / Q4 2025`. The banner, the chip
and the rail each say a different part of one sentence, and the reference is where
that division of labour is written down.
