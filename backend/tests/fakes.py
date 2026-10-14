"""In-memory реализация портов — use cases тестируются без БД."""
from __future__ import annotations

import copy
import itertools

from app.application.ports import ProductFilter
from app.domain.entities import OrderStatus, Role


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

    def delete(self, pid):
        self.data.pop(pid, None)

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

    def by_user(self, uid):
        return [copy.deepcopy(o) for o in self.data.values() if o.user_id == uid]

    def has_product(self, pid):
        return any(i.product_id == pid for o in self.data.values() for i in o.items)


class MemUsers:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1)

    def get(self, uid):
        return copy.deepcopy(self.data.get(uid))

    def _find(self, pred):
        return next((copy.deepcopy(u) for u in self.data.values() if pred(u)), None)

    def by_phone(self, digits):
        from app.application.orders import phone_digits
        return self._find(lambda u: phone_digits(u.phone) == digits)

    def by_link_token(self, token):
        return self._find(lambda u: u.tg_link_token == token)

    def by_chat(self, chat_id):
        found = sorted((u for u in self.data.values() if u.tg_chat_id == chat_id), key=lambda u: u.role == Role.ADMIN)
        return copy.deepcopy(found[0]) if found else None

    def admins(self):
        return [copy.deepcopy(u) for u in self.data.values() if u.role == Role.ADMIN]

    def add(self, u):
        u.id = next(self.seq)
        self.data[u.id] = copy.deepcopy(u)

    def save(self, u):
        self.data[u.id] = copy.deepcopy(u)


class PlainHasher:
    """Быстрый «хешер» для тестов use cases (в API-тестах — настоящий Argon2)."""
    def hash(self, password):
        return "h:" + password

    def verify(self, password, password_hash):
        return password_hash == "h:" + password


class FakeNotifier:
    def __init__(self):
        self.sent = []

    def send(self, chat_id, text, link=None, button="Открыть"):
        self.sent.append((chat_id, text))
        self.links = getattr(self, "links", []) + [link]


class FakeStorage:
    def signed_upload(self, path, content_type):
        from app.application.ports import SignedUpload
        return SignedUpload(f"https://upload.test/{path}", f"https://cdn.test/{path}")


class MemUow:
    def __init__(self):
        self.products = MemProducts()
        self.orders = MemOrders()
        self.waves = MemWaves(self.orders)
        self.users = MemUsers()
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass
