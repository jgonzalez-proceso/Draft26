-- Alinea el nombre de la selección con la app (WC2026_TEAMS usa "Chequia").
-- Los jugadores conservan su national_team_id, así que su plantilla se mantiene.
update public.national_teams
set name = 'Chequia', flag_url = 'https://flagcdn.com/w320/cz.png'
where name = 'República Checa';
