from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import inspect


def serialize(model) -> dict:
    result = {}
    for column in inspect(model).mapper.column_attrs:
        value = getattr(model, column.key)
        if isinstance(value, (UUID, Decimal, date, datetime)):
            value = str(value)
        result[column.key] = value
    return result
