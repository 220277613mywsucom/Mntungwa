create or replace function public.validate_event_times()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.end_at is not null and new.end_at <= new.start_at then
    raise exception 'Event end time must be after start time';
  end if;
  return new;
end;
$$;