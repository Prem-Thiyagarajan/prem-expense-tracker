# File: app/core/limiter.py
# Separate module so both main.py and routers can import the limiter
# without a circular import through main.
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
