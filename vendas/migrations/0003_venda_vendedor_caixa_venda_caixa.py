# Generated by Django 5.2.3 on 2025-06-23 03:12

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vendas', '0002_venda_transacao_id_provedor'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='venda',
            name='vendedor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='vendas_realizadas', to=settings.AUTH_USER_MODEL, verbose_name='Vendedor'),
        ),
        migrations.CreateModel(
            name='Caixa',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_abertura', models.DateTimeField(auto_now_add=True, verbose_name='Data e Hora de Abertura')),
                ('saldo_inicial', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Saldo de Abertura')),
                ('data_fechamento', models.DateTimeField(blank=True, null=True, verbose_name='Data e Hora de Fechamento')),
                ('saldo_final', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, verbose_name='Saldo de Fechamento')),
                ('status', models.CharField(choices=[('ABERTO', 'Aberto'), ('FECHADO', 'Fechado'), ('AUDITORIA', 'Em Auditoria')], default='ABERTO', max_length=10, verbose_name='Status do Caixa')),
                ('observacoes_abertura', models.TextField(blank=True, verbose_name='Observações na Abertura')),
                ('observacoes_fechamento', models.TextField(blank=True, verbose_name='Observações no Fechamento')),
                ('usuario_abertura', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='caixas_abertos', to=settings.AUTH_USER_MODEL, verbose_name='Usuário de Abertura')),
            ],
            options={
                'verbose_name': 'Sessão de Caixa',
                'verbose_name_plural': 'Sessões de Caixa',
                'ordering': ['-data_abertura'],
            },
        ),
        migrations.AddField(
            model_name='venda',
            name='caixa',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='vendas_caixa', to='vendas.caixa', verbose_name='Sessão de Caixa'),
        ),
    ]
