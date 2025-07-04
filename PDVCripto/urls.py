"""
URL configuration for PDVCripto project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

from core.views import custom_404_view
from estoque.views import EstoquePageView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('vendas/', include('vendas.urls')),
    path('produtos/', include('produtos.urls')),
    path('', include('core.urls')),
    path('estoque/', EstoquePageView.as_view(), name='estoque_listagem'), # NOVO: URL para a tela de estoque
    path('relatorios/', TemplateView.as_view(template_name='vendas/relatorios.html'), name='relatorios_listagem'),

]

handler404 = custom_404_view