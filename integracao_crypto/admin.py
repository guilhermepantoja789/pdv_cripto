# integracao_cripto/admin.py
from django.contrib import admin
from .models import CriptomoedaDetalhes

@admin.register(CriptomoedaDetalhes)
class CriptomoedaDetalhesAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'code', 'min_amount', 'max_amount', 'network', 'status',
        'is_fiat', 'last_updated'
    )
    search_fields = ('name', 'code', 'network')
    list_filter = ('is_fiat', 'status', 'network')
    readonly_fields = ('last_updated',) # A data de atualização é automática