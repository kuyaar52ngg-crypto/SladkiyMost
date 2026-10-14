"""In-memory реализация портов — use cases тестируются без БД."""
from __future__ import annotations

import copy
import itertools

from app.application.ports import ProductFilter
from app.domain.entities import OrderStatus


class MemProducts:
    def __init__(self):
        self.data = {}

    def list(self, f: ProductFilter):
        out = [p for p in self.data.values() if f.include_inactive or p.active]
        if f.regions:
            out = [p for p in out if p.region.value in f.regions]
        if f.categories:
            out = [p for p in out if p.category in f.categories]
        if f.query:
            out = [p for p in out if f.query.lower() in (p.name + p.description).lower()]
        return [copy.deepcopy(p) for p in out]

    def get(self, pid):
        return copy.deepcopy(self.data.get(pid))

    def get_many(self, ids):
        return {i: copy.deepcopy(self.data[i]) for i in ids if i in self.data}

    def save(self, p):
        self.data[p.id] = copy.deepcopy(p)

    def ids_with_prefix(self, prefix):
        return [i for i in self.data if i.startswith(prefix + "-")]


class MemWaves:
    def __init__(self, orders):
        self.data, self.orders = {}, orders

    def list(self, direction=None):
        return sorted((copy.deepcopy(w) for w in self.data.values() if not direction or w.direction == direction),
                      key=lambda w: (w.departure, w.direction))

    def get(self, wid):
        return copy.deepcopy(self.data.get(wid))

    def existing_ids(self):
        return set(self.data)

    def add(self, w):
        self.save(w)

    def save(self, w):
        self.data[w.id] = copy.deepcopy(w)

    def orders_weight(self):
        out = {}
        for o in self.orders.data.values():
            if o.status != OrderStatus.CANCELLED:
                out[o.wave_id] = out.get(o.wave_id, 0) + o.weight_kg
        return out


class MemOrders:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1025)

    def next_number(self):
        return next(self.seq)

    def add(self, o):
        self.data[o.number] = copy.deepcopy(o)

    save = add

    def get(self, n):
        return copy.deepcopy(self.data.get(n))

    def list(self, *, status=None, wave_id=None):
        return [copy.deepcopy(o) for o in self.data.values()
                if (not status or o.status == status) and (not wave_id or o.wave_id == wave_id)]

    def by_phone(self, digits):
        from app.application.orders import phone_digits
        return [copy.deepcopy(o) for o in self.data.values()
                if digits in (phone_digits(o.customer_phone), phone_digits(o.recipient.phone))]


class MemUow:
    def __init__(self):
        self.products = MemProducts()
        self.orders = MemOrders()
        self.waves = MemWaves(self.orders)
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass
