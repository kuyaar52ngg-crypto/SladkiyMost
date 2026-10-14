"""accounts, product gallery, order owner

Revision ID: 4d65c8453bd3
Revises: 1130a4ce76a6
Create Date: 2026-10-14 15:20:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '4d65c8453bd3'
down_revision: Union[str, Sequence[str], None] = '1130a4ce76a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.Column('phone', sa.String(length=40), nullable=False),
        sa.Column('phone_digits', sa.String(length=10), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=160), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('tg_chat_id', sa.BigInteger(), nullable=True),
        sa.Column('tg_link_token', sa.String(length=64), nullable=True),
        sa.Column('failed_logins', sa.Integer(), nullable=False),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('phone_digits'),
        sa.UniqueConstraint('tg_link_token'),
    )
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)

    op.create_table(
        'product_photos',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_id', sa.String(length=16), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_product_photos_product_id'), 'product_photos', ['product_id'], unique=False)

    op.add_column('products', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                                        nullable=False))
    op.alter_column('products', 'photo', type_=sa.String(length=500), existing_nullable=False)
    op.alter_column('order_items', 'photo', type_=sa.String(length=500), existing_nullable=False)

    op.add_column('orders', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_orders_user_id'), 'orders', ['user_id'], unique=False)
    op.create_foreign_key('orders_user_id_fkey', 'orders', 'users', ['user_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('orders_user_id_fkey', 'orders', type_='foreignkey')
    op.drop_index(op.f('ix_orders_user_id'), table_name='orders')
    op.drop_column('orders', 'user_id')
    op.alter_column('order_items', 'photo', type_=sa.String(length=200), existing_nullable=False)
    op.alter_column('products', 'photo', type_=sa.String(length=200), existing_nullable=False)
    op.drop_column('products', 'created_at')
    op.drop_index(op.f('ix_product_photos_product_id'), table_name='product_photos')
    op.drop_table('product_photos')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_table('users')
