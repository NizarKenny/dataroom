# What I would build next

Ordered by what a deal stalls without, not by what is interesting to build. Each
entry says what it unblocks and the shape the answer takes in this codebase,
because knowing the shape is most of knowing the cost.

The room as it stands could carry a friendly bilateral deal with one buyer and
nothing in it you would mind reading in a newspaper. The first three entries are
what stands between that and a real process.

## Before it holds a real deal

**An invitation that only its recipient can claim.** Today an invitation is
matched by the email on the account at first sign-in, and email confirmation is
off so the demo needs no mailbox. Anyone who knows an invited address can sign up
as it, and on a deal that list is knowable: it is on the engagement letter. The
answer is not a stricter check on the token, whose `email_verified` claim the
account itself can write. The invitation has to carry its own secret and the link
in the email has to be what claims it: a token column on `shares`, a mailer, and
a claim route that trades the token for the grant.

**A second administrator on the sell side.** `data_rooms.owner_id` is one column
and every write ends at `requireOwner`. On a real deal the CFO loads financials,
counsel loads legal, and the banker maintains the index, so today all three share
one password, which is the exact thing a data room exists to prevent. It also
destroys attribution before there is anything to attribute. The shape is a
membership table with a role, `requireOwner` becoming `requireRole`, and a route
that transfers the room.

**A log of who opened what.** Asked for twice on every deal: by the buyer's
counsel as a closing condition, and by the seller the hour somebody says the
customer list is in the wrong hands. It is the only thing on this page that
cannot be reconstructed afterwards. It is also nearly free here, because every
read already passes through one function, `grantFor` in `permissions.ts`, so
there is exactly one place to write the row. It is worth nothing until the
invitation above is fixed, though: a log of who opened what means nothing while
"who" is unproven, which is why they ship together.

## Then, in the order a deal asks for them

**Document versions.** Week two of every deal something is re-issued. Today
`onConflict: 'replace'` writes new bytes over the same object key and keeps the
row, which is right for keeping links alive and wrong for disclosure: "the
management accounts as they stood in the room on 14 March" is unanswerable, and
the disclosure letter is written against exactly that. A version table and a
second object key.

**Notifications.** Four documents go in on day 12 and nobody is told; the other
side finds them by rereading the Modified column. Cheap to build, and the daily
value is out of proportion to the cost.

**Bulk download.** Normally a convenience, here a retention risk: the buyer's
team wants a folder offline tonight, gets forty files one signed URL at a time,
gives up, and asks for a zip over email. Now the deal is running outside the room
and the audit trail is worth less.

**Expiring access.** No `expiresAt` anywhere in the schema. Manual revocation
works for one buyer if you remember. In an auction where six bidders drop out on
a deadline, "if you remember" is not a control.

**Search.** For three hundred documents in a numbered index, browsing is fine.
Above a couple of thousand it is not. `pg_trgm` on `files.name`.

**Q&A between the sides.** Table stakes above one bidder or three workstreams,
survivable on email below that. One answer given to everyone at once, and a
record of who was told what, is the thing email cannot do.

## Operational, and owed whatever else happens

**Cutting off an access token before it expires.** Revoking a share is immediate,
because every request rereads the row. Signing out is not: the API verifies the
signature and nothing else, so a token already issued works until it expires, an
hour by default. The cheap half is a shorter expiry in the Supabase settings; the
real half is checking the session against Supabase per request, which is a round
trip to close a window that only opens with a stolen token.

**Sweeping orphaned objects.** An upload somebody walks away from leaves an
object with no row. A nightly job comparing the bucket against `files`.

**Rate limiting the link routes.** A token is 32 characters of base64url, so
guessing one is not the threat. A link being hammered is, and that is a counter
in Redis rather than in one serverless instance's memory.

**Keyset pagination on a folder listing.** Past a few thousand children the
endpoint should page on `(folder_id, name)`. That index already exists.

## Not planned

**Watermarking and view-only.** For a bilateral deal under NDA, dynamic
watermarks are theatre. For a competitive auction they are a real deterrent and
would move up this list, but they are the wrong thing to build before the three
at the top.

**Redaction in the product.** Nobody redacts in the data room. Counsel redacts in
Acrobat and uploads the redacted copy. In-product redaction is mostly a way to
ship black boxes that copy and paste back out.

**Holding one document back from a shared folder.** A share reaches everything
inside it and there is no exclusion anywhere in the model, which is why there is
nothing to forget. The cost is real: in every Legal folder there is one document
that goes to the principal and not to the bidder. Today a seller moves it to a
folder the bidder does not have, which works and renumbers their index. Adding a
deny rule would buy that back and cost the property that makes the rest of this
model defensible, so it is a decision rather than an omission.
