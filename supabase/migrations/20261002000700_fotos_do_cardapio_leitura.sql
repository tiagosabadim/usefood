-- E04 · Trocar e apagar fotos: a API do Storage confere a leitura antes de apagar.
-- O público continua vendo as fotos pelo link público do bucket; esta regra vale para a API.
create policy "dono e gerente veem os arquivos do cardápio" on storage.objects
  for select to authenticated
  using (bucket_id = 'cardapio' and private.pode_editar_arquivo_do_cardapio(name));
