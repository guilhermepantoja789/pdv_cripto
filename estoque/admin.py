# estoque/admin.py
from django.contrib import admin
from .models import MovimentoEstoque

@admin.register(MovimentoEstoque)
class MovimentoEstoqueAdmin(admin.ModelAdmin):
    list_display = (
        'produto', 'tipo_movimento', 'quantidade', 'data_movimento',
        'observacao'
    )
    list_filter = ('tipo_movimento', 'data_movimento', 'produto')
    search_fields = ('produto__nome', 'produto__codigo_barras', 'observacao')
    readonly_fields = ('data_movimento',) # Data de movimento é automática
    # A adição/edição de movimentos de VENDA será feita por código, não pelo admin
    # mas outros tipos podem ser adicionados manualmente aqui.