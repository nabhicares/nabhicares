from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import inspect


def camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(word[:1].upper() + word[1:] for word in rest)


def serialize(model) -> dict:
    # The web and mobile clients were written against the original Node API and read
    # camelCase fields, so snake_case column names would render as blank cells.
    result = {}
    for column in inspect(model).mapper.column_attrs:
        value = getattr(model, column.key)
        if isinstance(value, (date, datetime)):
            # str() separates date and time with a space, which Safari refuses to parse.
            value = value.isoformat()
        elif isinstance(value, (UUID, Decimal)):
            value = str(value)
        result[camel(column.key)] = value
    return result
