-- Invite/signup failed: duplicate key on platforms_name_key when a trigger re-seeded
-- platform/payment_method rows that already exist as system masters (user_id IS NULL).
-- Drop only auth.users triggers whose trigger function body references inserting into
-- public.platforms or public.payment_methods (custom seed triggers; not in this repo).

do $$
declare
  tr record;
  fn_src text;
begin
  for tr in
    select t.tgname, t.tgfoid
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
  loop
    begin
      fn_src := lower(pg_get_functiondef(tr.tgfoid));
    exception
      when others then
        select lower(coalesce(p.prosrc, ''))
        into fn_src
        from pg_proc p
        where p.oid = tr.tgfoid;
    end;

    if fn_src like '%insert%'
       and (
         fn_src like '%platforms%'
         or fn_src like '%payment_methods%'
       )
    then
      execute format('drop trigger if exists %I on auth.users', tr.tgname);
      raise notice 'Dropped trigger auth.users.% (seeded platforms/payment_methods)', tr.tgname;
    end if;
  end loop;
end;
$$;
