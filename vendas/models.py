# vendas/models.py
from django.contrib.auth.models import User
from django.db import models
from produtos.models import Produto # Importa o modelo Produto
from estoque.models import MovimentoEstoque # Importa o modelo MovimentoEstoque
from decimal import Decimal # Para cálculos precisos

class Venda(models.Model):
    FORMA_PAGAMENTO_CHOICES = [
        ('DINHEIRO', 'Dinheiro'),
        ('CARTAO', 'Cartão'),
        ('PIX', 'PIX'),
        ('CRIPTOMOEDA', 'Criptomoeda'),
        # Podemos adicionar mais formas de pagamento no futuro
    ]

    data_hora = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data e Hora da Venda"
    )
    total_bruto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Total Bruto"
    )
    desconto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'), # Garante que o padrão é Decimal
        verbose_name="Desconto Aplicado"
    )
    total_liquido = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Total Líquido"
    )
    forma_pagamento = models.CharField(
        max_length=20,
        choices=FORMA_PAGAMENTO_CHOICES,
        verbose_name="Forma de Pagamento"
    )
    transacao_id_provedor = models.CharField(
        max_length=255,  # Tamanho suficiente para IDs longos
        blank=True,  # Não é obrigatório (para pagamentos em dinheiro/cartão)
        null=True,  # Pode ser nulo no banco de dados
        unique=True,  # Garante que cada ID de provedor seja único (opcional, mas bom para PIX/Cripto)
        verbose_name="ID Transação Provedor Pagamento",
        help_text="ID da transação no gateway de pagamento (Pix TXID, CoinPayments txn_id, etc.)"
    )
    # Futuramente: Vendedor (ForeignKey para User), Cliente (ForeignKey para Cliente)

    vendedor = models.ForeignKey(
        User,  # Referencia o modelo de usuário ativo no projeto
        blank=True,
        null=True,
        on_delete=models.PROTECT,  # Protege o usuário de ser deletado se tiver vendas
        related_name='vendas_realizadas',
        verbose_name="Vendedor"
    )
    caixa = models.ForeignKey(
        'Caixa',  # Referencia o modelo Caixa que vamos definir abaixo
        on_delete=models.PROTECT,  # Protege o caixa de ser deletado se tiver vendas
        related_name='vendas_caixa',
        null=True,  # Será nulo até que um caixa esteja aberto
        blank=True,  # Permite vazio no Admin/Formulários
        verbose_name="Sessão de Caixa"
    )

    class Meta:
        verbose_name = "Venda"
        verbose_name_plural = "Vendas"
        ordering = ['-data_hora'] # Vendas mais recentes primeiro

    def __str__(self):
        return f"Venda #{self.id} - Total: R${self.total_liquido:.2f} ({self.forma_pagamento})"

class ItemVenda(models.Model):
    venda = models.ForeignKey(
        Venda,
        on_delete=models.CASCADE, # Se a venda for deletada, os itens da venda também são
        related_name='itens',
        verbose_name="Venda"
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT, # Protege o produto de ser deletado se estiver em alguma venda
        verbose_name="Produto"
    )
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3, # Permite quantidades decimais (para KG, L, etc.)
        verbose_name="Quantidade Vendida"
    )
    preco_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Preço Unitário na Venda"
    )
    subtotal_item = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Subtotal do Item"
    )

    class Meta:
        verbose_name = "Item de Venda"
        verbose_name_plural = "Itens de Venda"
        # Garante que não haja dois itens de venda para o mesmo produto na mesma venda,
        # embora o ideal seja somar a quantidade em vez de criar um novo item.
        # unique_together = ('venda', 'produto')

    def __str__(self):
        return f"{self.quantidade} {self.produto.unidade_medida} de {self.produto.nome} na Venda #{self.venda.id}"

class Caixa(models.Model):
    STATUS_CHOICES = [
        ('ABERTO', 'Aberto'),
        ('FECHADO', 'Fechado'),
        ('AUDITORIA', 'Em Auditoria'), # Opcional: para casos de divergência
    ]

    usuario_abertura = models.ForeignKey(
        User,
        blank=True,
        null=True,
        on_delete=models.PROTECT,
        related_name='caixas_abertos',
        verbose_name="Usuário de Abertura"
    )
    data_abertura = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data e Hora de Abertura"
    )
    saldo_inicial = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Saldo de Abertura"
    )
    data_fechamento = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Data e Hora de Fechamento"
    )
    saldo_final = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Saldo de Fechamento"
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='ABERTO',
        verbose_name="Status do Caixa"
    )
    observacoes_abertura = models.TextField(
        blank=True,
        verbose_name="Observações na Abertura"
    )
    observacoes_fechamento = models.TextField(
        blank=True,
        verbose_name="Observações no Fechamento"
    )

    class Meta:
        verbose_name = "Sessão de Caixa"
        verbose_name_plural = "Sessões de Caixa"
        ordering = ['-data_abertura']

    def __str__(self):
        status_text = self.get_status_display()
        return f"Caixa #{self.id} - {status_text} por {self.usuario_abertura.username} em {self.data_abertura.strftime('%d/%m/%Y %H:%M')}"