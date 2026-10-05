-- Delivery lançado pela equipe (PDV e comanda): celular, endereço e taxa de entrega.
-- O ticket da cozinha passa a levar os dados da entrega, para o entregador achar o cliente.

drop function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, text, public.payment_method, integer);

create function public.criar_pedido(
  p_restaurant_id uuid,
  p_tipo public.order_type,
  p_identificador_tipo public.identifier_type,
  p_identificador text,
  p_itens jsonb,
  p_observacao text default null,
  p_pagamento_previsto public.payment_method default null,
  p_troco_para_cents integer default null,
  p_celular text default null,
  -- {"cep","rua","numero","complemento","bairro","cidade","referencia"}
  p_endereco jsonb default null,
  p_taxa_entrega_cents integer default null
)
returns table (id uuid, numero integer, identificador text, total_cents integer, conta_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_conta uuid;
  v_celular text := nullif(regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g'), '');
begin
  if p_tipo = 'mesa' and p_identificador_tipo <> 'mesa' then
    raise exception 'Pedido de mesa precisa do número da mesa' using errcode = '22023';
  end if;
  if v_celular is not null and v_celular !~ '^[0-9]{10,11}$' then
    raise exception 'Confira o celular: DDD e número.' using errcode = '22023';
  end if;
  if p_tipo = 'delivery' and (p_endereco is null or coalesce(trim(p_endereco ->> 'rua'), '') = ''
      or coalesce(trim(p_endereco ->> 'numero'), '') = '' or coalesce(trim(p_endereco ->> 'bairro'), '') = '') then
    raise exception 'Delivery precisa de rua, número e bairro.' using errcode = '22023';
  end if;
  if p_taxa_entrega_cents is not null and (p_taxa_entrega_cents < 0 or p_taxa_entrega_cents > 100000) then
    raise exception 'Taxa de entrega inválida' using errcode = '22023';
  end if;

  select * into v from private.criar_pedido_sem_impressao(
    p_restaurant_id, p_tipo, p_identificador_tipo, p_identificador, p_itens, false, p_observacao);

  if p_identificador_tipo = 'mesa' then
    select t.id into v_conta from public.tabs t
    where t.restaurant_id = p_restaurant_id and t.identifier_type = 'mesa' and t.status = 'aberta'
      and lower(t.identifier) = lower(v.identificador)
    for update;
  end if;

  if v_conta is null then
    insert into public.tabs (restaurant_id, type, identifier_type, identifier, expected_method, change_for_cents, opened_by,
                             customer_name, customer_phone, delivery_address, delivery_fee_cents)
    values (p_restaurant_id, p_tipo, p_identificador_tipo, v.identificador, p_pagamento_previsto,
            case when p_pagamento_previsto = 'dinheiro' then p_troco_para_cents end, (select auth.uid()),
            case when p_identificador_tipo = 'nome' then v.identificador end, v_celular,
            case when p_tipo = 'delivery' then p_endereco end,
            case when p_tipo = 'delivery' then coalesce(p_taxa_entrega_cents, 0) else 0 end)
    returning tabs.id into v_conta;
  end if;

  update public.orders o set tab_id = v_conta where o.id = v.id;
  perform private.recalcular_conta(v_conta);
  perform private.gerar_impressoes(v.id, 'pedido');

  return query select v.id, v.numero, v.identificador, v.total_cents, v_conta;
end;
$$;
revoke execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, text, public.payment_method, integer, text, jsonb, integer) from public, anon;
grant execute on function public.criar_pedido(uuid, public.order_type, public.identifier_type, text, jsonb, text, public.payment_method, integer, text, jsonb, integer) to authenticated;

-- O ticket leva nome, telefone, endereço e quanto cobrar
create or replace function private.gerar_impressoes(p_pedido uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_praca record;
  v_payload jsonb;
  v_impressora record;
  v_tem_impressora boolean;
  v_total integer := 0;
begin
  select o.id, o.restaurant_id, o.number, o.type, o.identifier_type, o.identifier, o.notes, o.created_at,
         r.name as loja, r.timezone,
         t.customer_name, t.customer_phone, t.delivery_address, t.expected_method, t.change_for_cents,
         t.total_cents as conta_total, t.paid_cents as conta_paga, t.delivery_fee_cents
  into v_pedido
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.tabs t on t.id = o.tab_id
  where o.id = p_pedido;
  if not found then
    return 0;
  end if;

  for v_praca in
    select distinct s.id, s.name from public.order_items i
    join public.stations s on s.id = i.station_id
    where i.order_id = p_pedido
  loop
    v_payload := jsonb_build_object(
      'tipo', p_tipo,
      'loja', v_pedido.loja,
      'praca', v_praca.name,
      'numero', v_pedido.number,
      'pedido_tipo', v_pedido.type,
      'identificador_tipo', v_pedido.identifier_type,
      'identificador', v_pedido.identifier,
      'criado_em', to_char(v_pedido.created_at at time zone v_pedido.timezone, 'DD/MM HH24:MI'),
      'observacao', v_pedido.notes,
      -- Dados para quem entrega (ou para chamar na retirada)
      'entrega', case when v_pedido.type in ('delivery', 'retirada') then jsonb_build_object(
        'nome', coalesce(v_pedido.customer_name, v_pedido.identifier),
        'telefone', v_pedido.customer_phone,
        'endereco', v_pedido.delivery_address,
        'pagamento', v_pedido.expected_method,
        'troco_para', v_pedido.change_for_cents,
        'total', v_pedido.conta_total,
        'pago', v_pedido.conta_paga,
        'taxa', v_pedido.delivery_fee_cents) end,
      'itens', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'quantidade', i.quantity,
          'nome', i.product_name,
          'tamanho', i.variant_name,
          'adicionais', (
            select coalesce(jsonb_agg(m.name order by m.group_name, m.name), '[]'::jsonb)
            from public.order_item_modifiers m where m.order_item_id = i.id),
          'observacao', i.notes,
          'para_viagem', i.to_go
        ) order by i.created_at), '[]'::jsonb)
        from public.order_items i
        where i.order_id = p_pedido and i.station_id = v_praca.id)
    );

    v_tem_impressora := false;
    for v_impressora in
      select p.id from public.printers p where p.station_id = v_praca.id and p.is_active
    loop
      insert into public.print_jobs (restaurant_id, order_id, station_id, printer_id, kind, payload)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, v_impressora.id, p_tipo, v_payload);
      v_tem_impressora := true;
      v_total := v_total + 1;
    end loop;

    -- Praça sem impressora: a ordem já nasce com falha, para o PDV avisar
    if not v_tem_impressora then
      insert into public.print_jobs (restaurant_id, order_id, station_id, kind, payload, status, error)
      values (v_pedido.restaurant_id, p_pedido, v_praca.id, p_tipo, v_payload, 'falhou',
              'Praça ' || v_praca.name || ' sem impressora cadastrada');
    end if;
  end loop;

  return v_total;
end;
$$;
