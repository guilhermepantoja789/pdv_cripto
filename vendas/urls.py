# vendas/urls.py
from django.urls import path
from .views import *

urlpatterns = [
    path('pdv/', PdvView.as_view(), name='pdv'),
    path('api/finalizar-venda/', FinalizarVendaAPIView.as_view(), name='api_finalizar_venda'),
    path('api/gerar-pix/', GerarPixAPIView.as_view(), name='api_gerar_pix'), # NOVO: URL para PIX
    path('api/consultar-pix-status/', ConsultarPixStatusAPIView.as_view(), name='api_consultar_pix_status'), # NOVO
    path('api/gerar-cripto/', GerarCriptoAPIView.as_view(), name='api_gerar_cripto'), # NOVO: URL para Cripto
    path('api/consultar-cripto-status/', ConsultarCriptoStatusAPIView.as_view(), name='api_consultar_cripto_status'), # NOVO
    path('api/listar-criptos/', ListarCriptosAPIView.as_view(), name='api_listar_criptos'), # NOVO
    path('api/caixa/abrir/', AbrirCaixaAPIView.as_view(), name='api_abrir_caixa'),
    path('api/caixa/fechar/', FecharCaixaAPIView.as_view(), name='api_fechar_caixa'),
    path('api/caixa/status/', ConsultarCaixaStatusAPIView.as_view(), name='api_caixa_status'), # NOVO
    path('api/relatorios/resumo-vendas/', ResumoVendasAPIView.as_view(), name='api_resumo_vendas'),
    path('api/relatorios/mais-vendidos/', ProdutosMaisVendidosAPIView.as_view(), name='api_produtos_mais_vendidos'),
    path('api/vendas/<int:venda_id>/detalhes/', DetalhesVendaAPIView.as_view(), name='api_detalhes_venda'), # NOVO
]