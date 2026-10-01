from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """The frontend directory/roster/dossier views all request a large
    single page (page_size=200) on the assumption they get everything at
    once — they don't paginate through subsequent pages. Without
    page_size_query_param, DRF silently ignores that and caps every list at
    PAGE_SIZE (25), so once a department passes 25 faculty the alphabetically
    last ones just vanish from rosters, submission-wizard dropdowns, etc.
    with no error. max_page_size keeps a client-supplied page_size from
    being unbounded.
    """

    page_size_query_param = "page_size"
    max_page_size = 500
