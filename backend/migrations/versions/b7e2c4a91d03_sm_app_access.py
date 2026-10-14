"""доступ роли приложения sm_app ко всем таблицам

Revision ID: b7e2c4a91d03
Revises: 0629714655b4
Create Date: 2026-10-14 21:10:00

API в Supabase работает под отдельной ролью sm_app без обхода RLS: ей нужны
GRANT и политика на каждой таблице. Миграция выдаёт их всем таблицам схемы public
и настраивает права по умолчанию для будущих таблиц. Если роли нет (локальная база) —
ничего не делает.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7e2c4a91d03'
down_revision: Union[str, Sequence[str], None] = '0629714655b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    do $$
    declare t text;
    begin
      if not exists (select 1 from pg_roles where rolname = 'sm_app') then
        return;
      end if;
      for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'alembic_version' loop
        execute format('grant select, insert, update, delete on public.%I to sm_app', t);
        if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'app_all') then
          execute format('create policy app_all on public.%I for all to sm_app using (true) with check (true)', t);
        end if;
      end loop;
      grant usage, select, update on all sequences in schema public to sm_app;
      alter default privileges in schema public grant select, insert, update, delete on tables to sm_app;
      alter default privileges in schema public grant usage, select, update on sequences to sm_app;
    end $$;
    """)


def downgrade() -> None:
    pass
