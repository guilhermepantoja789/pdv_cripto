# vendas/admin.py
from django.contrib import admin
from .models import Venda, ItemVenda, Caixa


# Classe Inline para exibir Itens de Venda dentro da Venda no Admin
class ItemVendaInline(admin.TabularInline):
    model = ItemVenda
    extra = 0  # Não adiciona campos extras vazios por padrão
    readonly_fields = ('produto', 'quantidade', 'preco_unitario',
                       'subtotal_item',)  # Itens de venda não editáveis no admin
    can_delete = False  # Impede que itens de venda sejam deletados via admin, a menos que a venda seja cancelada

@admin.register(Venda)
class VendaAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'data_hora', 'total_liquido', 'forma_pagamento',
        'vendedor', 'caixa', 'transacao_id_provedor'  # NOVOS CAMPOS AQUI
    )
    list_filter = ('forma_pagamento', 'data_hora', 'vendedor',
                   'caixa__status')  # Filtros por vendedor e status do caixa
    search_fields = ('id', 'transacao_id_provedor', 'vendedor__username')
    readonly_fields = (
        'data_hora', 'total_bruto', 'desconto', 'total_liquido',
        'forma_pagamento', 'transacao_id_provedor',
        'vendedor', 'caixa'  # Tornar esses campos readonly no Admin
    )
    inlines = [ItemVendaInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# NOVO: Registrar o modelo Caixa no Admin
@admin.register(Caixa)
class CaixaAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'usuario_abertura', 'data_abertura', 'saldo_inicial',
        'data_fechamento', 'saldo_final', 'status'
    )
    list_filter = ('status', 'data_abertura', 'usuario_abertura')
    search_fields = ('usuario_abertura__username', 'id')
    readonly_fields = ('data_abertura', 'data_fechamento')  # Estes campos são automáticos ou definidos ao fechar

    # Pode-se querer permitir que um admin feche um caixa, mas a abertura deve ser pelo sistema
    # Para simplicidade, vamos permitir a criação e edição básica para testes.