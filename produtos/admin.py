# produtos/admin.py
from django.contrib import admin
from .models import Produto

@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = (
        'nome', 'codigo_barras', 'preco_venda', 'estoque', 'unidade_medida', # Adicione aqui
        'ativo', 'data_atualizacao'
    )
    search_fields = ('nome', 'codigo_barras')
    list_filter = ('ativo', 'data_cadastro', 'unidade_medida') # Adicione aqui também
    readonly_fields = ('data_cadastro', 'data_atualizacao')
    fieldsets = (
        (None, {
            'fields': (('nome', 'codigo_barras'), 'descricao', 'ativo')
        }),
        ('Preços', {
            'fields': ('preco_custo', 'preco_venda')
        }),
        ('Estoque', {
            'fields': ('estoque', 'estoque_minimo', 'unidade_medida') # Adicione aqui
        }),
        ('Datas', {
            'fields': ('data_cadastro', 'data_atualizacao'),
            'classes': ('collapse',)
        })
    )