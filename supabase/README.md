# Supabase (Home v2 database)

Host: repurposed project `sandybill`, ref `meinjdymzihqeajwwgkq`, org `sandybill`.
This folder is the source-of-truth for the schema, security model, seed, and tests.
All three migrations and the seed are already applied to the remote (via the
Supabase integration). These files mirror that state so it is re-runnable locally.

## Apply order

```
supabase db reset            # or apply in order against an empty database:
  extensions: pgcrypto, citext   (already installed on the remote)
  migrations/0001_base_schema.sql            # kit schema: 27 tables, 11 enums, indexes
  migrations/0002_enable_rls_deny_by_default.sql   # RLS on every table, no policies = deny
  migrations/0003_m1_security_isolation.sql  # helpers + household-isolation policies
  seed.sql                                   # Green demo day + Rivera counterparty
```

## Security model (M1)

Authored from the kit's `docs/04_PERMISSIONS_AND_PRIVACY.md`, not a prewritten
`10_RLS_REFERENCE.sql` (that file was not in the kit). See ADR-0010. Isolation-first:
deny-by-default everywhere, then household members read/write only their own
household's rows via SECURITY DEFINER helpers in schema `app`. `calendar_connections`
(credentials) and audit writes stay server-only.

## Tests

`tests/rls_isolation.sql` is the M1 cross-household isolation suite. It impersonates
seeded users and proves two households cannot read or alter each other's data. All
blocks passed on 2026-07-04. This covers the database (direct-query) layer. Realtime,
storage, and assistant isolation are verified when those surfaces are wired (they ride
on the same RLS).

## Notes

- 98 RLS policies across 26 tables; `calendar_connections` intentionally has none.
- The `citext` extension currently sits in `public` (minor advisory); it moves to the
  `extensions` schema in the 012 hardening migration.
- Migrations are tracked remotely via the integration; if you adopt the Supabase CLI
  locally, reconcile the migration history before `db push`.
