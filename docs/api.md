# The API

`https://nizar-dataroom-api.vercel.app`

Three kinds of route, and the difference is the whole design.

- **Signed in.** Everything under `/rooms`, `/folders`, `/files` and `/shares`.
  Send `Authorization: Bearer <supabase access token>`.
- **Public link.** Everything under `/links/:token`. No account, no header. The
  token is the credential.
- **Neither.** `GET /` and `GET /health`.

Every route that reaches a node in the tree goes through the same access
function, and the public link routes go through it too, so a link holder and an
invited reader cannot drift apart. Two routes answer a different question and so
do not use it: `GET /rooms` asks which rooms exist for this person, and
`DELETE /shares/:id` only has to know who owns the room.

## Rooms

| | | |
| --- | --- | --- |
| `GET` | `/rooms` | Rooms you own and rooms shared with you. Totals only for the ones you own, and an `entry` saying where opening it lands: the root for an owner, the granted node for a reader |
| `POST` | `/rooms` | `{ name }`. Creates the room and its root folder in one transaction |
| `GET` | `/rooms/:id` | Name, your role, the root folder id |
| `PATCH` | `/rooms/:id` | `{ name }`. Renames the room and its root folder together |
| `DELETE` | `/rooms/:id` | Cascades the tree and sweeps the room's objects out of the bucket |
| `GET` | `/rooms/:id/folders` | Every folder in the room, flat, for the move dialog. Owner only |
| `GET` | `/rooms/:id/search?q=` | Files anywhere in the room whose name contains `q`, each with the folder it sits in. Cut down to what the caller may read, and the trail clipped at their grant |

## Folders

| | | |
| --- | --- | --- |
| `GET` | `/folders/:id` | `?page=&modified=&sort=&dir=` where `modified` is `any`, `today`, `week`, `month` or `year`, `sort` is `name`, `size` or `modified`, and `dir` is `asc` or `desc`. Folders keep the top of the listing whatever the sort, and fall back to their names when it is by size, because a folder has no size. The listing: the folder, its breadcrumbs, one page of its subfolders and files, and for an owner what reaches each row. Fifty rows to a page, folders first and then files, both by name |
| `POST` | `/folders` | `{ parentId, name }` |
| `PATCH` | `/folders/:id` | `{ name?, parentId? }`. A rename touches one row. A move rewrites the subtree's paths and the shares pointing into it, in one transaction behind a per room advisory lock |
| `DELETE` | `/folders/:id` | Revokes the shares inside first, so a link says it was switched off rather than answering 404 |
| `GET` | `/folders/:id/manifest` | What a delete would take: folders, files, bytes, shares. Owner only |

## Files

Uploads go in two steps, and the bytes never pass through this API.

| | | |
| --- | --- | --- |
| `POST` | `/folders/:folderId/uploads` | `{ name, sizeBytes, onConflict }` where `onConflict` is `fail`, `rename` or `version`. Settles the name and returns a signed URL to PUT the bytes at, plus the version those bytes will be. Writes nothing to the database |
| `POST` | `/folders/:folderId/files` | `{ fileId, name, version }`. Records the file once the bytes are there. Size comes from storage, not from you. A type the browser would run is refused and the object removed. Recording the same version twice is not an error, so a retry is safe |
| `GET` | `/files/:id/download-url` | `?disposition=inline\|attachment`. A URL that expires in five minutes |
| `PATCH` | `/files/:id` | `{ name?, folderId? }`. Neither touches the object: its key is built from ids |
| `DELETE` | `/files/:id` | Revokes any share of the file, then removes the row and every version's object |
| `GET` | `/files/:id/versions` | What this document has been, newest first. Owner only |
| `GET` | `/files/:id/versions/:version/download-url` | One older version, named for it. Owner only |
| `POST` | `/files/:id/versions/:version/restore` | Makes an older version current by adding a new one that points at its bytes. Owner only |

## Shares

| | | |
| --- | --- | --- |
| `GET` | `/shares?resourceType=&resourceId=` | Everything that reaches this node, each marked inherited or not. Owner only |
| `POST` | `/shares` | `{ resourceType, resourceId, mode, email? }`. `mode` is `public_link` or `user`. Inviting the same person twice returns the existing share rather than an error |
| `DELETE` | `/shares/:id` | Revokes. The row stays, so a dead link can say so |

`resourceType` is `data_room`, `folder` or `file`.

## Public links

| | | |
| --- | --- | --- |
| `GET` | `/links/:token` | What the link points at: a folder to open, or a single file |
| `GET` | `/links/:token/folders/:id` | The same listing as above, `?page=`, `?modified=`, `?sort=` and `?dir=` included, refused for anything outside the shared subtree |
| `GET` | `/links/:token/files/:id/download-url` | Same as the signed in version, for a file the link reaches |
| `GET` | `/links/:token/search?q=` | The same search, inside what the link reaches |

## Errors

```json
{ "error": "not_found", "message": "That folder does not exist, or you do not have access to it" }
```

| Code | Status | |
| --- | --- | --- |
| `unauthorized` | 401 | No token, or one that no longer verifies |
| `read_only` | 403 | You can see this, but not change it |
| `share_revoked` | 403 | The link was switched off. Only ever said to someone holding the token |
| `not_found` | 404 | The node does not exist, **or** it is not yours to see. Deliberately the same answer: a 403 would confirm that a folder with that id is real |
| `bad_request` | 400 | A name with a separator, a file over the limit, a folder moved into itself |
| `name_taken` | 409 | A sibling already has that name. The unique index is what decides, not a check beforehand |
| `version_raced` | 409 | The file gained a version between signing the upload and recording it, which means two uploads of it overlapped |
| `internal` | 500 | Anything unrecognised. The message never says what, because the caller learns nothing useful from it and an attacker would |

---

[Documentation index](README.md) · [The repository README](../README.md) ·
[What comes next](roadmap.md)
