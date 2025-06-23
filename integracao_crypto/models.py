# integracao_cripto/models.py
from django.db import models

class CriptomoedaDetalhes(models.Model):
    code = models.CharField(
        max_length=50,
        unique=True, # O código da moeda deve ser único
        verbose_name="Código da Moeda"
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Nome da Moeda"
    )
    min_amount = models.DecimalField(  # Voltou para DecimalField
        max_digits=30,
        decimal_places=15,
        verbose_name="Valor Mínimo Transacionável",
        null=True,  # Permite nulo no BD
        blank=True  # Permite vazio no Admin
    )
    max_amount = models.DecimalField(  # Voltou para DecimalField
        max_digits=30,
        decimal_places=15,
        verbose_name="Valor Máximo Transacionável",
        null=True,  # Permite nulo no BD
        blank=True  # Permite vazio no Admin
    )
    network = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Rede (Blockchain)" # Ex: "tron", "bitcoin", "ethereum"
    )
    status = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="Status da Moeda" # Ex: "active", "inactive"
    )
    is_fiat = models.BooleanField(
        default=False,
        verbose_name="É Moeda Fiduciária?"
    )
    last_updated = models.DateTimeField(
        auto_now=True, # Atualiza automaticamente na cada save
        verbose_name="Última Atualização"
    )

    class Meta:
        verbose_name = "Detalhe de Criptomoeda"
        verbose_name_plural = "Detalhes de Criptomoedas"
        ordering = ['name'] # Ordena por nome

    def __str__(self):
        return f"{self.name} ({self.code.upper()}) - Min: {self.min_amount} - Network: {self.network or 'N/A'}"