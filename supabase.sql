-- Execute no SQL Editor do Supabase.
-- Os pedidos existentes ficam sem autor e precisam ser associados manualmente.

alter table public.pedidos
    add column if not exists user_id uuid references auth.users(id);

create index if not exists pedidos_user_id_idx
    on public.pedidos(user_id);

alter table public.pedidos enable row level security;

drop policy if exists "Usuários podem visualizar seus pedidos" on public.pedidos;
create policy "Usuários podem visualizar seus pedidos"
    on public.pedidos
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Usuários podem criar seus pedidos" on public.pedidos;
create policy "Usuários podem criar seus pedidos"
    on public.pedidos
    for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "Usuários podem atualizar seus pedidos" on public.pedidos;
create policy "Usuários podem atualizar seus pedidos"
    on public.pedidos
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "Usuários podem excluir seus pedidos" on public.pedidos;
create policy "Usuários podem excluir seus pedidos"
    on public.pedidos
    for delete
    to authenticated
    using (user_id = auth.uid());
