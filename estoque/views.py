from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import render
from django.views.generic import TemplateView

# Create your views here.
class EstoquePageView(LoginRequiredMixin, UserPassesTestMixin, TemplateView):
    template_name = 'estoque/listagem.html'

    def test_func(self):
        return self.request.user.is_staff