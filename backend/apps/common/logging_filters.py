import logging

from apps.common.middleware import get_current_correlation_id


class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = get_current_correlation_id()
        return True
