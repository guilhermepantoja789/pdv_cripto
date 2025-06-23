# produtos/urls.py
from django.urls import path
from .views import *
urlpatterns = [
    # URL para a API de busca de produtos
    path('api/buscar-produto/', ProdutoSearchView.as_view(), name='api_buscar_produto'),
    path('api/estoque/listar/', EstoqueListView.as_view(), name='api_estoque_listar'),
    path('api/estoque/ajustar/', EstoqueAjusteAPIView.as_view(), name='api_estoque_ajustar'),

]