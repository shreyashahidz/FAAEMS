from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assistant.engine import AssistantError, answer_question
from apps.assistant.models import AssistantQueryLog


class AssistantQueryView(APIView):
    def post(self, request):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response({"detail": "Please ask a question."}, status=400)

        try:
            result = answer_question(question, request.user)
            AssistantQueryLog.objects.create(
                user=request.user,
                question=question,
                matched_intent=result["matched_intent"],
                answer=result["answer"],
                evidence_ids_cited=result["evidence_ids"],
                api_calls=result["api_calls"],
            )
            return Response(result)
        except AssistantError as exc:
            AssistantQueryLog.objects.create(
                user=request.user,
                question=question,
                matched_intent="",
                answer=str(exc),
                evidence_ids_cited=[],
                api_calls=[],
            )
            return Response({"answer": str(exc), "matched_intent": "", "evidence_ids": [], "api_calls": []})

    def get(self, request):
        logs = AssistantQueryLog.objects.filter(user=request.user)[:20]
        return Response(
            [
                {
                    "id": log.id,
                    "question": log.question,
                    "answer": log.answer,
                    "matched_intent": log.matched_intent,
                    "evidence_ids_cited": log.evidence_ids_cited,
                    "created_at": log.created_at,
                }
                for log in logs
            ]
        )
