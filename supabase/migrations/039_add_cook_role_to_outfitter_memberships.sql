-- Allow 'cook' role in outfitter_memberships (for cook invite flow)
-- The table has a check constraint outfitter_memberships_role_check that currently
-- only allows owner, admin, guide. We add 'cook'.

ALTER TABLE outfitter_memberships
  DROP CONSTRAINT IF EXISTS outfitter_memberships_role_check,
  ADD CONSTRAINT outfitter_memberships_role_check
    CHECK (role IN ('owner', 'admin', 'guide', 'cook'));

COMMENT ON CONSTRAINT outfitter_memberships_role_check ON outfitter_memberships IS
  'Allowed roles: owner, admin, guide, cook';
