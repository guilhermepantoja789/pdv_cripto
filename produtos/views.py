# produtos/views.py
from decimal import Decimal

from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db import transaction
from django.db.models import F, Q
from django.http import JsonResponse
from django.views.generic import View

from estoque.models import MovimentoEstoque
from .models import Produto
import json

class ProdutoSearchView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        codigo_barras = request.GET.get('codigo_barras', None)

        if not codigo_barras:
            return JsonResponse({'error': 'Código de barras não fornecido.'}, status=400)

        try:
            produto = Produto.objects.get(codigo_barras=codigo_barras, ativo=True)
            data = {
                'id': produto.id,
                'nome': produto.nome,
                'preco_venda': str(produto.preco_venda),
                'estoque': str(produto.estoque),
                'codigo_barras': produto.codigo_barras,
                'unidade_medida': produto.unidade_medida, # NOVO: Adicionado aqui
                # Adicione outros campos que você precise no frontend
            }
            return JsonResponse(data)
        except Produto.DoesNotExist:
            return JsonResponse({'error': 'Produto não encontrado ou inativo.'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


# NOVA CLASSE: API para Listar Produtos com Detalhes de Estoque
class EstoqueListView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        # Filtros de pesquisa
        search_query = request.GET.get('q', '')  # Parâmetro de busca (nome ou código)
        status_filter = request.GET.get('status', 'todos')  # 'todos', 'ativo', 'inativo', 'baixo_estoque'

        produtos = Produto.objects.all().order_by('nome')

        if search_query:
            produtos = produtos.filter(
                Q(nome__icontains=search_query) | Q(codigo_barras__icontains=search_query)
            )

        if status_filter == 'ativo':
            produtos = produtos.filter(ativo=True)
        elif status_filter == 'inativo':
            produtos = produtos.filter(ativo=False)
        elif status_filter == 'baixo_estoque':
            # Produtos onde o estoque atual é menor ou igual ao estoque mínimo
            produtos = produtos.filter(estoque__lte=F('estoque_minimo'))

        produtos_data = []
        for produto in produtos:
            produtos_data.append({
                'id': produto.id,
                'codigo_barras': produto.codigo_barras,
                'nome': produto.nome,
                'preco_venda': str(produto.preco_venda),
                'estoque': str(produto.estoque),
                'estoque_minimo': str(produto.estoque_minimo),
                'unidade_medida': produto.unidade_medida,
                'ativo': produto.ativo,
                'status_estoque': 'baixo' if produto.estoque <= produto.estoque_minimo else 'normal'
            })

        return JsonResponse({'produtos': produtos_data}, status=200)


# NOVA CLASSE: API para Ajuste Manual de Estoque (Entrada/Saída/Ajuste)
class EstoqueAjusteAPIView(LoginRequiredMixin, UserPassesTestMixin, View):

    def test_func(self):
        return self.request.user.is_staff

    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            produto_id = data.get('produto_id')
            tipo_movimento = data.get('tipo_movimento')  # 'ENTRADA', 'SAIDA', 'AJUSTE'
            quantidade = Decimal(str(data.get('quantidade', '0.00')))
            observacao = data.get('observacao', '')

            if not produto_id or not tipo_movimento or quantidade <= 0:
                return JsonResponse({'error': 'Dados inválidos para o ajuste de estoque.'}, status=400)

            try:
                produto = Produto.objects.get(id=produto_id)
            except Produto.DoesNotExist:
                return JsonResponse({'error': 'Produto não encontrado.'}, status=404)

            with transaction.atomic():
                # Atualiza o estoque do produto
                if tipo_movimento == 'ENTRADA':
                    produto.dar_entrada_estoque(quantidade)  # Reutiliza método do modelo Produto
                elif tipo_movimento == 'SAIDA':
                    # Verifica se há estoque suficiente para saída manual
                    if produto.estoque < quantidade:
                        raise ValueError(
                            f"Estoque insuficiente para saída de '{produto.nome}'. Disponível: {produto.estoque}")
                    produto.dar_baixa_estoque(quantidade)  # Reutiliza método do modelo Produto
                elif tipo_movimento == 'AJUSTE':
                    # Para ajuste, a quantidade pode ser positiva (aumento) ou negativa (redução)
                    # O ajuste aqui sempre adiciona/subtrai diretamente
                    # Se for para 'setar' um valor final, a lógica seria diferente.
                    # Vamos assumir que 'AJUSTE' é como 'ENTRADA'/'SAIDA' mas com observação específica.
                    # Se for um AJUSTE que reduz, verificar estoque.
                    if quantidade < 0 and produto.estoque < abs(quantidade):
                        raise ValueError(
                            f"Estoque insuficiente para ajuste de redução de '{produto.nome}'. Disponível: {produto.estoque}")
                    produto.estoque += quantidade  # A quantidade pode ser negativa para ajuste
                    produto.save()
                else:
                    return JsonResponse({'error': 'Tipo de movimento inválido.'}, status=400)

                # Registra o movimento de estoque
                MovimentoEstoque.objects.create(
                    produto=produto,
                    tipo_movimento=tipo_movimento,
                    quantidade=quantidade,
                    observacao=observacao,
                    # usuario_responsavel=request.user # Futuramente, vincular ao usuário logado
                )

            return JsonResponse({
                'message': f'Estoque de {produto.nome} ajustado com sucesso!',
                'novo_estoque': str(produto.estoque)
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos.'}, status=400)
        except ValueError as ve:
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado ao ajustar estoque: {str(e)}'}, status=500)