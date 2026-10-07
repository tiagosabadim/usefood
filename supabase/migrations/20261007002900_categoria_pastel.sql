-- Pastel como categoria do app (primeiro cliente: pastelaria). Entra logo depois de Lanches.
alter type public.cuisine_type add value if not exists 'pastel' after 'lanches';
