# estoque/models.py
from django.db import models
from produtos.models import Produto # Importa o modelo Produto

class MovimentoEstoque(models.Model):
    TIPO_MOVIMENTO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SAIDA', 'Saída'),
        ('AJUSTE', 'Ajuste'),
        ('VENDA', 'Venda'), # Movimento gerado por uma venda no PDV
    ]

    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT, # Protege o produto de ser deletado se houver movimentos
        related_name='movimentos_estoque',
        verbose_name="Produto"
    )
    tipo_movimento = models.CharField(
        max_length=10,
        choices=TIPO_MOVIMENTO_CHOICES,
        verbose_name="Tipo de Movimento"
    )
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3, # Permite quantidades decimais
        verbose_name="Quantidade"
    )
    data_movimento = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data do Movimento"
    )
    observacao = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observação"
    )
    # Adicionar quem fez o movimento pode ser útil, mas por enquanto simplificamos:
    # usuario = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True)

    class Meta:
        verbose_name = "Movimento de Estoque"
        verbose_name_plural = "Movimentos de Estoque"
        ordering = ['-data_movimento'] # Movimentos mais recentes primeiro

    def __str__(self):
        return (f"{self.tipo_movimento} de {self.quantidade} {self.produto.unidade_medida} "
                f"de {self.produto.nome} em {self.data_movimento.strftime('%d/%m/%Y %H:%M')}")