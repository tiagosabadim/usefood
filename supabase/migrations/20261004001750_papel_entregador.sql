-- Papel novo na equipe: entregador. Fica sozinho nesta migration porque o Postgres
-- só deixa usar um valor novo de enum depois que ele é gravado (a próxima migration usa).
alter type public.restaurant_role add value if not exists 'entregador';
