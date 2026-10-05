-- Entrega sem entregador no app: dono, gerente ou caixa despacham e confirmam pelo painel.
-- O código do cliente continua obrigatório para o entregador; para a loja é opcional
-- (ex.: o motoboy terceirizado volta e o caixa confirma).

create or replace function public.confirmar_entrega(p_pedido uuid, p_codigo text default null)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select o.id, o.restaurant_id, o.status, t.customer_phone into v
  from public.orders o left join public.tabs t on t.id = o.tab_id
  where o.id = p_pedido for update of o;
  if not found or not private.pode_entregar(v.restaurant_id) then
    raise exception 'Pedido não encontrado ou sem permissão' using errcode = '42501';
  end if;
  if v.status <> 'em_entrega' then
    raise exception 'Este pedido não está em entrega' using errcode = 'P0001';
  end if;
  -- Código digitado: tem que conferir, seja quem for
  if nullif(trim(p_codigo), '') is not null and v.customer_phone is not null
     and trim(p_codigo) <> right(v.customer_phone, 4) then
    raise exception 'O código não confere. Peça ao cliente os 4 últimos números do celular.' using errcode = 'P0001';
  end if;
  -- Sem código: só a loja (dono, gerente, caixa) confirma
  if nullif(trim(p_codigo), '') is null and v.customer_phone is not null and not private.pode_cobrar(v.restaurant_id) then
    raise exception 'Digite o código do cliente: os 4 últimos números do celular.' using errcode = 'P0001';
  end if;
  update public.orders set status = 'concluido', delivered_at = now() where id = p_pedido;
  return 'concluido'::public.order_status;
end;
$$;
