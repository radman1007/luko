"""
دستیارِ هوشمندِ والدین — GET گفت‌وگو (`?c=<شناسه>|new`؛ بی‌آن آخرین گفت‌وگو) و سهمیه، POST پرسشِ تازه
(`conversation` اختیاری؛ بی‌آن گفت‌وگوی تازه)، DELETE پاک کردنِ یک گفت‌وگو، و فهرستِ گفت‌وگوها (تاریخچه).
تحلیلِ نقاشی‌های بچه هم این‌جاست (apps.ai.paintings).
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.parent.models import ParentChild
from apps.parent.permissions import IsParent

from . import paintings
from .assistant import AssistantError, ask, conversation_row, conversations, delete_conversation, message_row, thread


def _child(request, child_id):
    link = ParentChild.objects.filter(parent=request.user, child_id=child_id, is_active=True) \
        .select_related("child").first()
    return link.child if link else None


def _not_found(message="فرزند پیدا نشد."):
    return Response({"error": {"code": 404, "message": message}}, status=status.HTTP_404_NOT_FOUND)


def _failed(error: AssistantError):
    return Response({"error": {"code": error.status, "message": error.message, "reason": error.code}},
                    status=error.status)


def _conversation_param(value):
    value = str(value or "").strip()
    if value == "new":
        return "new"
    return int(value) if value.isdigit() else None


class AssistantView(APIView):
    permission_classes = [IsParent]

    def get(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        try:
            return Response(thread(request.user, child, _conversation_param(request.query_params.get("c"))))
        except AssistantError as error:
            return _failed(error)

    def post(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        conversation = _conversation_param(request.data.get("conversation"))
        try:
            question, reply = ask(request.user, child, str(request.data.get("text") or ""),
                                  str(request.data.get("tier") or "flash"),
                                  conversation if isinstance(conversation, int) else None)
        except AssistantError as error:
            return _failed(error)
        return Response({"conversation": conversation_row(question.conversation),
                         "messages": [message_row(question), message_row(reply)]}, status=status.HTTP_201_CREATED)

    def delete(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        conversation = _conversation_param(request.query_params.get("c"))
        try:
            return Response({"deleted": delete_conversation(request.user, child,
                                                            conversation if isinstance(conversation, int) else None)})
        except AssistantError as error:
            return _failed(error)


class ConversationListView(APIView):
    """تاریخچه‌ی گفت‌وگوها — فقط با اشتراکِ همین فرزند فهرست دارد"""

    permission_classes = [IsParent]

    def get(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        return Response(conversations(request.user, child))


class PaintingListView(APIView):
    """نقاشی‌های بچه برای والد (بندانگشتی و وضعیتِ تحلیل)"""

    permission_classes = [IsParent]

    def get(self, request, child_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        return Response(paintings.gallery(child))


class PaintingDetailView(APIView):
    """GET تصویرِ کامل و تحلیل · POST درخواستِ تحلیل (فقط با اشتراکِ همین فرزند)"""

    permission_classes = [IsParent]

    def get(self, request, child_id, painting_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        painting = paintings.find(child, painting_id)
        if painting is None:
            return _not_found("نقاشی پیدا نشد.")
        return Response(paintings.detail(child, painting))

    def post(self, request, child_id, painting_id):
        child = _child(request, child_id)
        if child is None:
            return _not_found()
        painting = paintings.find(child, painting_id)
        if painting is None:
            return _not_found("نقاشی پیدا نشد.")
        try:
            paintings.request_analysis(request.user, child, painting)
        except AssistantError as error:
            return _failed(error)
        return Response(paintings.detail(child, painting), status=status.HTTP_202_ACCEPTED)
