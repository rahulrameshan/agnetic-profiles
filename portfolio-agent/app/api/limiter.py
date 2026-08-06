"""
Per-IP rate limiting.

Its own module so routes can decorate with it without importing the app, which
would be circular.

Counting is in-process, which is why the service runs a single worker — extra
workers would multiply the effective limit on an endpoint that spends money.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
