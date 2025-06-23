# integracao_cripto/management/commands/sync_cripto_data.py
import decimal
import json
import requests
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db import transaction  # Para garantir atomicidade
from decimal import Decimal  # Para lidar com valores decimais

from integracao_crypto.models import CriptomoedaDetalhes  # Importa seu modelo de detalhes
import os  # Para os.getenv, caso precise carregar algo extra


class Command(BaseCommand):
    help = 'Sincroniza os detalhes das criptomoedas (min/max/network) da NOWPayments para o banco de dados local.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO("Iniciando sincronização de dados de criptomoedas com NOWPayments..."))

        # Configurações da NOWPayments
        api_key = settings.NOWPAYMENTS_API_KEY
        base_url = settings.NOWPAYMENTS_API_BASE_URL

        if not api_key or not base_url:
            raise CommandError("Credenciais NOWPayments (API_KEY ou BASE_URL) não configuradas no settings.py ou .env.")

        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }

        # --- Etapa 1: Obter moedas com min/max (currencies?fixed_rate=true) ---
        currencies_with_min_max_url = f"{base_url}currencies"
        try:
            params = {'fixed_rate': 'true'}
            response_min_max = requests.get(currencies_with_min_max_url, headers=headers, params=params)
            response_min_max.raise_for_status()  # Lança HTTPError para 4xx/5xx status
            data_min_max = response_min_max.json()
            currencies_min_max = data_min_max.get('currencies', [])
            self.stdout.write(self.style.SUCCESS(f"Obtidas {len(currencies_min_max)} moedas com min/max."))
        except requests.exceptions.RequestException as e:
            raise CommandError(
                f"Erro ao obter moedas com min/max da NOWPayments: {e}. Resposta: {e.response.text if e.response else 'N/A'}")
        except json.JSONDecodeError:
            raise CommandError(f"Erro ao decodificar JSON da resposta de moedas com min/max: {response_min_max.text}")

        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }
        # --- Etapa 2: Obter detalhes completos das moedas (full-currencies) ---
        full_currencies_url = f"{base_url}full-currencies"
        try:
            response_full = requests.get(full_currencies_url, headers=headers)
            response_full.raise_for_status()
            data_full = response_full.json()
            full_currencies = data_full.get('currencies')  # A NOWPayments retorna 'full_currencies' como chave principal
            self.stdout.write(self.style.SUCCESS(f"Obtidas {len(full_currencies)} moedas com detalhes completos."))
        except requests.exceptions.RequestException as e:
            raise CommandError(
                f"Erro ao obter detalhes completos das moedas da NOWPayments: {e}. Resposta: {e.response.text if e.response else 'N/A'}")
        except json.JSONDecodeError:
            raise CommandError(f"Erro ao decodificar JSON da resposta de moedas completas: {response_full.text}")

        # --- Etapa 3: Mesclar os dados e sincronizar com o banco de dados ---
        merged_currencies = {}
        # lista_de_currencies = []
        # for curr in currencies_min_max:
        #     if curr['currency'] not in lista_de_currencies:
        #         lista_de_currencies.append(curr['currency'])
        # print(lista_de_currencies)
        # print(full_currencies)
        # 3.1: Primeiro, adiciona dados de min/max (que são a base)
        for details in currencies_min_max:
            code = details.get('currency')
            if code:
                # --- CORREÇÃO AQUI: Conversão robusta para Decimal ---
                min_amount_val = details.get('min_amount')
                max_amount_val = details.get('max_amount')

                try:
                    # Converte para Decimal, lidando com None/vazio. Se não for conversível, usa '0'.
                    min_amount_decimal = Decimal(str(min_amount_val)) if min_amount_val is not None and str(
                        min_amount_val).strip() != '' else Decimal('0')
                except (ValueError, TypeError, decimal.InvalidOperation):
                    self.stdout.write(
                        self.style.WARNING(f"Aviso: min_amount inválido para {code}: '{min_amount_val}'. Usando 0."))
                    min_amount_decimal = Decimal('0')

                try:
                    max_amount_decimal = Decimal(str(max_amount_val)) if max_amount_val is not None and str(
                        max_amount_val).strip() != '' else Decimal('0')
                except (ValueError, TypeError, decimal.InvalidOperation):
                    self.stdout.write(
                        self.style.WARNING(f"Aviso: max_amount inválido para {code}: '{max_amount_val}'. Usando 0."))
                    max_amount_decimal = Decimal('0')

                merged_currencies[code] = {
                    'code': code,
                    'name': details.get('name', code.upper()),
                    'min_amount': min_amount_decimal,  # Use o Decimal convertido de forma segura
                    'max_amount': max_amount_decimal,  # Use o Decimal convertido de forma segura
                    'status': details.get('status'),
                    'is_fiat': details.get('is_fiat', False),
                    'network': None,  # Será preenchido pelo full_currencies
                }
        # 3.2: Mescla dados completos (como 'network')
        # A resposta de full-currencies é uma lista de dicionários, como a anterior.
        #print(full_currencies)
        for details_full in full_currencies:  # Itera sobre a lista de dicionários de full_currencies
            code = details_full.get('code').lower()  # Campo 'code' para full-currencies
            if code and code in merged_currencies:
                merged_currencies[code]['network'] = details_full.get('network')
                # Adicione outros campos de full_currencies se precisar mesclar
                # Ex: merged_currencies[code]['logo_url'] = details_full.get('logo_url')

        # 3.3: Sincronizar com o banco de dados
        created_count = 0
        updated_count = 0

        with transaction.atomic():  # Garante que a operação é atômica
            for code, data in merged_currencies.items():
                # Tenta obter o objeto existente ou cria um novo
                obj, created = CriptomoedaDetalhes.objects.update_or_create(
                    code=code,
                    defaults={
                        'name': data['name'],
                        'min_amount': data['min_amount'],
                        'max_amount': data['max_amount'],
                        'network': data['network'],
                        'status': data['status'],
                        'is_fiat': data['is_fiat'],
                        # last_updated é auto_now=True
                    }
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Sincronização concluída! Criados: {created_count}, Atualizados: {updated_count} registros."))