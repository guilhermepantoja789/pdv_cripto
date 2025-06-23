from decimal import Decimal

from django.db import models

# Create your models here.

# produtos/models.py
from django.db import models

class Produto(models.Model):
    UNIDADE_MEDIDA_CHOICES = [
        ('UN', 'Unidade'),
        ('KG', 'Quilograma'),
        ('L', 'Litro'),
        ('M', 'Metro'),  # Para produtos vendidos por metro (ex: tecidos, fios)
        ('DZ', 'Dúzia'),
        ('CX', 'Caixa'),
    ]

    codigo_barras = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Código de Barras",
        help_text="Código único do produto (GTIN, EAN, UPC)"
    )
    nome = models.CharField(
        max_length=200,
        verbose_name="Nome do Produto"
    )
    descricao = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descrição Detalhada"
    )
    preco_custo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Preço de Custo"
    )
    preco_venda = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Preço de Venda"
    )
    estoque = models.DecimalField( # Usamos DecimalField para estoque para flexibilidade (ex: kg)
        max_digits=10,
        decimal_places=3, # 3 casas decimais para quantidades como peso
        default=0,
        verbose_name="Estoque Atual"
    )
    estoque_minimo = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        verbose_name="Estoque Mínimo"
    )
    ativo = models.BooleanField(
        default=True,
        verbose_name="Ativo para Venda"
    )
    data_cadastro = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Cadastro"
    )
    data_atualizacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Última Atualização"
    )
    unidade_medida = models.CharField(
        max_length=2,
        choices=UNIDADE_MEDIDA_CHOICES,
        default='UN',
        verbose_name="Unidade de Medida",
        help_text="Unidade usada para medir o estoque e a venda do produto (Ex: UN, KG, L)"
    )

    def dar_baixa_estoque(self, quantidade_vendida):
        if not isinstance(quantidade_vendida, (int, float, Decimal)):
            raise TypeError("A quantidade vendida deve ser um número.")

        quantidade_vendida = Decimal(str(quantidade_vendida))  # Garante que é Decimal

        if self.estoque < quantidade_vendida:
            raise ValueError(
                f"Estoque insuficiente para {self.nome}. Disponível: {self.estoque}, Vendido: {quantidade_vendida}")

        self.estoque -= quantidade_vendida
        self.save()  # Salva a alteração no banco de dados
        return True  # Retorna True se a baixa foi bem-sucedida

    # NOVO MÉTODO para dar entrada no estoque (opcional, mas útil)
    def dar_entrada_estoque(self, quantidade_recebida):
        if not isinstance(quantidade_recebida, (int, float, Decimal)):
            raise TypeError("A quantidade recebida deve ser um número.")

        quantidade_recebida = Decimal(str(quantidade_recebida))  # Garante que é Decimal

        self.estoque += quantidade_recebida
        self.save()
        return True

    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} ({self.codigo_barras})"