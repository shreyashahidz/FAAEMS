from django.urls import path

from apps.assistant.views import AssistantQueryView

urlpatterns = [
    path("assistant/query/", AssistantQueryView.as_view(), name="assistant-query"),
]
