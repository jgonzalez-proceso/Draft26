-- Corrige la posición de Emiliano Martínez (Argentina, Aston Villa) de MID a GK.
-- El jugador de Uruguay (Palmeiras) conserva su posición MID.
update public.players
set primary_position = 'GK'
where full_name = 'Emiliano Martínez'
  and national_team_id = (
    select id from public.national_teams where name = 'Argentina'
  );
