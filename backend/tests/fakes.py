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
        if f.shop_id is not None:
            out = [p for p in out if p.shop_id == f.shop_id]
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

    def of_shop(self, shop_id):
        return [copy.deepcopy(u) for u in self.data.values() if u.shop_id == shop_id]

    def by_email(self, email):
        e = email.strip().lower()
        return [copy.deepcopy(u) for u in self.data.values() if (u.email or "").lower() == e]

    def customers(self):
        return [copy.deepcopy(u) for u in self.data.values() if u.role == Role.CUSTOMER]

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


class MemAddresses:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1)

    def of_user(self, uid):
        return sorted((copy.deepcopy(a) for a in self.data.values() if a.user_id == uid),
                      key=lambda a: (not a.is_default, a.id))

    def get(self, aid):
        return copy.deepcopy(self.data.get(aid))

    def add(self, a):
        a.id = next(self.seq)
        self.data[a.id] = copy.deepcopy(a)

    def save(self, a):
        if a.id is None:
            return self.add(a)
        self.data[a.id] = copy.deepcopy(a)

    def delete(self, aid):
        self.data.pop(aid, None)


class MemNotifications:
    def __init__(self):
        self.data, self.seq = [], itertools.count(1)

    def add(self, n):
        n.id = next(self.seq)
        self.data.append(copy.deepcopy(n))

    def of_user(self, uid, limit=100):
        return [copy.deepcopy(n) for n in reversed(self.data) if n.user_id == uid][:limit]

    def mark_read(self, uid, ids=None):
        for n in self.data:
            if n.user_id == uid and (ids is None or n.id in ids):
                n.read = True


class MemTickets:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1)

    def add(self, t):
        t.number = next(self.seq)
        self.data[t.number] = copy.deepcopy(t)

    def get(self, n):
        return copy.deepcopy(self.data.get(n))

    def save(self, t):
        self.data[t.number] = copy.deepcopy(t)

    def list(self, user_id=None):
        return [copy.deepcopy(t) for t in sorted(self.data.values(), key=lambda t: -t.number)
                if user_id is None or t.user_id == user_id]


class MemShops:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1)

    def get(self, sid):
        return copy.deepcopy(self.data.get(sid))

    def list(self):
        return [copy.deepcopy(s) for s in self.data.values()]

    def add(self, s):
        s.id = next(self.seq)
        self.data[s.id] = copy.deepcopy(s)

    def save(self, s):
        if s.id is None:
            return self.add(s)
        self.data[s.id] = copy.deepcopy(s)


class MemShopOrders:
    def __init__(self):
        self.data = {}

    def get(self, n, sid):
        return copy.deepcopy(self.data.get((n, sid)))

    def of_shop(self, sid):
        return [copy.deepcopy(v) for (n, s), v in self.data.items() if s == sid]

    def of_order(self, n):
        return [copy.deepcopy(v) for (o, s), v in self.data.items() if o == n]

    def save(self, so):
        self.data[(so.order_number, so.shop_id)] = copy.deepcopy(so)


class MemCategories:
    def __init__(self):
        from app.application.content import DEFAULT_CATEGORIES
        from app.domain.entities import Category
        self.data, self.seq = {}, itertools.count(1)
        for i, n in enumerate(DEFAULT_CATEGORIES):
            self.add(Category(None, n, i))

    def list(self):
        return sorted((copy.deepcopy(c) for c in self.data.values()), key=lambda c: (c.position, c.id))

    def get(self, cid):
        return copy.deepcopy(self.data.get(cid))

    def add(self, c):
        c.id = next(self.seq)
        self.data[c.id] = copy.deepcopy(c)

    def save(self, c):
        if c.id is None:
            return self.add(c)
        self.data[c.id] = copy.deepcopy(c)

    def delete(self, cid):
        self.data.pop(cid, None)


class MemReviews:
    def __init__(self):
        self.data, self.seq = {}, itertools.count(1)

    def add(self, r):
        r.id = next(self.seq)
        self.data[r.id] = copy.deepcopy(r)

    def get(self, rid):
        return copy.deepcopy(self.data.get(rid))

    def save(self, r):
        self.data[r.id] = copy.deepcopy(r)

    def list(self, *, status=None, product_id=None, user_id=None):
        return [copy.deepcopy(r) for r in sorted(self.data.values(), key=lambda r: -r.id)
                if (status is None or r.status == status) and (product_id is None or r.product_id == product_id)
                and (user_id is None or r.user_id == user_id)]


class MemSettings:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return copy.deepcopy(self.data.get(key))

    def put(self, key, value):
        self.data[key] = copy.deepcopy(value)


class FakeMail:
    enabled = True

    def __init__(self):
        self.sent = []

    def send_link(self, email, redirect_to):
        self.sent.append((email, redirect_to))

    def email_of(self, access_token):
        return access_token.removeprefix("token-for:") if access_token.startswith("token-for:") else None


class MemUow:
    def __init__(self):
        self.products = MemProducts()
        self.orders = MemOrders()
        self.waves = MemWaves(self.orders)
        self.users = MemUsers()
        self.addresses = MemAddresses()
        self.notifications = MemNotifications()
        self.tickets = MemTickets()
        self.shops = MemShops()
        self.shop_orders = MemShopOrders()
        self.categories = MemCategories()
        self.reviews = MemReviews()
        self.settings = MemSettings()
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        pass

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass
