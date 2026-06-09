-- Permite al admin borrar el resultado publicado actual de La Porra.
-- Los snapshots del historial se conservan.
create or replace function public.reset_porra_results(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from league_members
    where league_id = p_league_id
      and user_id   = auth.uid()
      and role      = 'admin'
  ) then
    raise exception 'Solo el admin puede eliminar el resultado de La Porra';
  end if;

  delete from porra_results where league_id = p_league_id;
end;
$$;
