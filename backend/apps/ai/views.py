"""دستیارِ هوشمندِ والدین — GET گفت‌وگو و سهمیه، POST پرسشِ تازه، DELETE پاک‌کردنِ گفت‌وگو."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.parent.models import ParentChild
from apps.parent.permissions import IsParent

from .assistant import AssistantError, ask, clear, message_row, thread


def _child(request, child_id):
    link = ParentChild.objects.filter(parent=request.user, child_id=child_id, is_active=True) \
        .select_related("child").first()
    return link.child if link else None


def _not_found():
    return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}}, status=status.HTTP_404_NOT_FOUND)


class AssistantView(APIView):
    permission_classes = [IsParent]

    def get(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        return Response(thread(request.user, child))

    def post(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        try:
            question, reply = ask(request.user, child, str(request.data.get("text") or ""),
                                  str(request.data.get("tier") or "flash"))
        except AssistantError as error:
            return Response({"error": {"code": error.status, "message": error.message, "reason": error.code}},
                            status=error.status)
        return Response({"messages": [message_row(question), message_row(reply)]}, status=status.HTTP_201_CREATED)

    def delete(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        return Response({"deleted": clear(request.user, child)})
