-- One live public link per thing shared. Creating a link is idempotent in the
-- route, but two requests that overlap both read "no link yet" and both write,
-- and the loser of that race used to become a second token nobody could see:
-- the dialog shows one link, so turning it off left the other one working.
CREATE UNIQUE INDEX "shares_one_live_link" ON "shares"("resource_id")
  WHERE "mode" = 'public_link' AND "revoked_at" IS NULL;
