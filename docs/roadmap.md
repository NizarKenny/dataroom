# What I would build next

Ordered by what a deal stalls without, not by what is interesting to build.

The room as it stands could carry a friendly bilateral deal with one buyer and
nothing in it you would mind reading in a newspaper. The first four rows are what
stands between that and a real process.

Sizes are mine and rough: one developer who already knows this codebase, working
days, including the tests and the screen.

| | What | What it unblocks | Size |
| --- | --- | --- | --- |
| **1** | [Invitations that carry their own secret](#invitations-that-carry-their-own-secret) | An access list you can trust at all | 2 days |
| **2** | [A second administrator](#a-second-administrator) | Three people on the sell side, without one password | 3 days |
| **3** | [A log of who opened what](#a-log-of-who-opened-what) | The closing condition, and the day something leaks | 2 days |
| **4** | [Access that expires](#access-that-expires) | Six bidders dropping out on a deadline | 1 day |
| **5** | [Rate limiting the link routes](#rate-limiting-the-link-routes) | The one unauthenticated surface in the product | half a day |
| 6 | [Document versions](#document-versions) | The disclosure letter | 3 days |
| 7 | [Notifications](#notifications) | Four documents nobody was told about | 3 days |
| 8 | [Bulk download](#bulk-download) | Keeping the deal inside the room | 2 days |
| 9 | [Search](#search) | Anything past a couple of thousand documents | 1 day |
| 10 | [Q and A between the sides](#q-and-a-between-the-sides) | More than one bidder | 2 weeks |
| | [Sweeping orphaned objects](#sweeping-orphaned-objects) | Storage that matches the database | half a day |
| | [Cutting a token off early](#cutting-a-token-off-early) | Signing out meaning something | 1 day |
| | [Keyset pagination](#keyset-pagination) | Folders past a few thousand children | half a day |

Rows 1 to 5 ship before this holds a real deal. Three and four are the two I
would defend hardest in a planning meeting, for opposite reasons: three is the
only thing here that cannot be reconstructed afterwards, and four is the only one
that takes responsibility away rather than adding capability.

## Before it holds a real deal

### Invitations that carry their own secret

Today an invitation is matched by the email on the account at first sign-in, and
email confirmation is off so the demo needs no mailbox. Anyone who knows an
invited address can sign up as it, and on a deal that list is knowable: it is on
the engagement letter.

The answer is not a stricter check on the token, whose `email_verified` claim the
account itself can write. The invitation has to carry its own secret and the link
in the email has to be what claims it: a token column on `shares`, a mailer, and
a claim route that trades the token for the grant.

### A second administrator

`data_rooms.owner_id` is one column and every write ends at `requireOwner`. On a
real deal the CFO loads financials, counsel loads legal, and the banker maintains
the index, so today all three share one password, which is the exact thing a data
room exists to prevent. It also destroys attribution before there is anything to
attribute.

A membership table with a role, `requireOwner` becoming `requireRole`, and a route
that transfers the room.

### A log of who opened what

Asked for twice on every deal: by the buyer's counsel as a closing condition, and
by the seller the hour somebody says the customer list is in the wrong hands. It
is the only thing on this page that cannot be reconstructed afterwards.

It is also nearly free here, because every read already passes through one
function, `grantFor` in `permissions.ts`, so there is exactly one place to write
the row. It is worth nothing until the invitation above is fixed, though: a log
of who opened what means nothing while "who" is unproven, which is why they ship
together.

### Access that expires

No `expiresAt` anywhere in the schema, so revocation is manual and works if you
remember. In an auction where six bidders drop out on a deadline, "if you
remember" is not a control.

One column and one condition, next to the `revokedAt: null` that is already in
every access query. It sits this high because it is the cheapest thing on the
page and the only one that reduces what a person has to hold in their head.

### Rate limiting the link routes

A token is 32 characters of base64url, so guessing one is not the threat. A link
being hammered is, and a public link is the only surface in this product that
answers without an account. A counter in Redis rather than in one serverless
instance's memory, which is the only reason it is not already done.

## Then, in the order a deal asks for them

### Document versions

Week two of every deal something is re-issued. Today `onConflict: 'replace'`
writes new bytes over the same object key and keeps the row, which is right for
keeping links alive and wrong for disclosure: "the management accounts as they
stood in the room on 14 March" is unanswerable, and the disclosure letter is
written against exactly that. A version table and a second object key. Wants the
log above it to be useful, because a version history is a history.

### Notifications

Four documents go in on day 12 and nobody is told; the other side finds them by
rereading the Modified column. A daily digest per person per room, from the same
event the log writes, so it waits for the log rather than inventing its own feed.

### Bulk download

Normally a convenience, here a retention risk: the buyer's team wants a folder
offline tonight, gets forty files one signed URL at a time, gives up, and asks
for a zip over email. Now the deal is running outside the room and the audit
trail is worth less. Streamed zip for a folder, and a job for anything large.

### Search

For three hundred documents in a numbered index, browsing is fine. Above a couple
of thousand it is not. `pg_trgm` on `files.name`, one route, one field.

### Q and A between the sides

Table stakes above one bidder or three workstreams, survivable on email below
that. One answer given to everyone at once, and a record of who was told what, is
the thing email cannot do.

Much the largest thing on this page, and priced accordingly: it is a second kind
of content with its own access rules, its own visibility between bidders, and its
own notifications. Everything above it is a column or a table.

## Owed whatever else happens

### Sweeping orphaned objects

An upload somebody walks away from leaves an object with no row. A nightly job
comparing the bucket against `files`.

### Cutting a token off early

Revoking a share is immediate, because every request rereads the row. Signing out
is not: the API verifies the signature and nothing else, so a token already issued
works until it expires, an hour by default. The cheap half is a shorter expiry in
the Supabase settings; the real half is checking the session against Supabase per
request, which is a round trip to close a window that only opens with a stolen
token.

### Keyset pagination

Past a few thousand children a folder listing should page on `(folder_id, name)`.
That index already exists.

## Not planned

**Watermarking and view-only.** For a bilateral deal under NDA, dynamic
watermarks are theatre. For a competitive auction they are a real deterrent and
would move onto this page, but they are the wrong thing to build before the first
five rows.

**Redaction in the product.** Nobody redacts in the data room. Counsel redacts in
Acrobat and uploads the redacted copy. In-product redaction is mostly a way to
ship black boxes that copy and paste back out.

**Holding one document back from a shared folder.** A share reaches everything
inside it and there is no exclusion anywhere in the model, which is why there is
nothing to forget. The cost is real: in every legal folder there is one document
that goes to the principal and not to the bidder. Today a seller moves it to a
folder the bidder does not have, which works and renumbers their index. Adding a
deny rule would buy that back and cost the property that makes the rest of this
model defensible, so it is a decision rather than an omission.

---

[Documentation index](README.md) · [The repository README](../README.md) ·
[The design system](design/style-reference.html)
