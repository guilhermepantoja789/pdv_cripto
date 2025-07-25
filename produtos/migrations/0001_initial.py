# Generated by Django 5.2.3 on 2025-06-22 02:32

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Produto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo_barras', models.CharField(help_text='Código único do produto (GTIN, EAN, UPC)', max_length=100, unique=True, verbose_name='Código de Barras')),
                ('nome', models.CharField(max_length=200, verbose_name='Nome do Produto')),
                ('descricao', models.TextField(blank=True, null=True, verbose_name='Descrição Detalhada')),
                ('preco_custo', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Preço de Custo')),
                ('preco_venda', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Preço de Venda')),
                ('estoque', models.DecimalField(decimal_places=3, default=0, max_digits=10, verbose_name='Estoque Atual')),
                ('estoque_minimo', models.DecimalField(decimal_places=3, default=0, max_digits=10, verbose_name='Estoque Mínimo')),
                ('ativo', models.BooleanField(default=True, verbose_name='Ativo para Venda')),
                ('data_cadastro', models.DateTimeField(auto_now_add=True, verbose_name='Data de Cadastro')),
                ('data_atualizacao', models.DateTimeField(auto_now=True, verbose_name='Última Atualização')),
                ('unidade_medida', models.CharField(choices=[('UN', 'Unidade'), ('KG', 'Quilograma'), ('L', 'Litro'), ('M', 'Metro'), ('DZ', 'Dúzia'), ('CX', 'Caixa')], default='UN', help_text='Unidade usada para medir o estoque e a venda do produto (Ex: UN, KG, L)', max_length=2, verbose_name='Unidade de Medida')),
            ],
            options={
                'verbose_name': 'Produto',
                'verbose_name_plural': 'Produtos',
                'ordering': ['nome'],
            },
        ),
    ]
