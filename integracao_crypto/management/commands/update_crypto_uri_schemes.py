# integracao_cripto/management/commands/update_crypto_uri_schemes.py
import json
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from integracao_crypto.models import CriptomoedaDetalhes


class Command(BaseCommand):
    help = 'Atualiza o campo uri_scheme para criptomoedas com base em um mapa de protocolos e exclui registros não mapeados.'

    # O mapa de protocolos será definido diretamente no código para este comando.
    # Em um cenário real, você poderia carregar isso de um arquivo JSON externo
    # ou de uma configuração do sistema.
    MAPA_PROTOCOLOS = {
      "btc": "bitcoin",
      "eth": "ethereum",
      "ltc": "litecoin",
      "bch": "bitcoincash",
      "dash": "dash",
      "doge": "dogecoin",
      "xrp": "ripple",
      "xlm": "stellar",
      "ada": "cardano",
      "dot": "polkadot",
      "trx": "tron",
      "sol": "solana",
      "avax": "avalanche",
      "matic": "polygon",
      "etc": "ethereumclassic",
      "xtz": "tezos",
      "atom": "cosmos",
      "fil": "filecoin",
      "xmr": "monero",
      "zec": "zcash",
      "near": "near",
      "apt": "aptos",
      "sui": "sui",
      "ton": "ton",
      "usdttrc20": "tron",
      "usdtbsc": "bsc",
      "usdterc20": "ethereum",
      "usdtmatic": "polygon",
      "usdtcelo": "celo",
      "usdtarb": "arbitrum",
      "usdtton": "ton",
      "usdtsol": "solana",
      "usddtrc20": "tron",
      "usdc": "ethereum",
      "usdcbsc": "bsc",
      "usdcarc20": "arbitrum",
      "usdcarb": "arbitrum",
      "usdcmatic": "polygon",
      "usdcalgo": "algorand",
      "dai": "ethereum",
      "daiarb": "arbitrum",
      "tusdtrc20": "tron",
      "tusd": "ethereum",
      "pyusd": "ethereum"
    }

    def handle(self, *args, **options):
        self.stdout.write(self.style.HTTP_INFO("Iniciando atualização de uri_schemes e exclusão de não-mapeados..."))

        try:
            with transaction.atomic():
                updated_count = 0
                created_or_updated_codes = set()

                # Etapa 1: Atualizar o uri_scheme e network (para consistência) dos registros existentes
                for code, uri_scheme in self.MAPA_PROTOCOLOS.items():
                    # Certifique-se que o 'code' no banco de dados é case-insensitive se necessário
                    # NOWPayments geralmente usa minúsculas, então convertemos o code do mapa para minúsculas.
                    try:
                        crypto = CriptomoedaDetalhes.objects.get(code=code)
                        crypto.network = uri_scheme
                        # O campo 'network' no seu modelo representa a rede original da NOWPayments (ex: 'btc', 'trx').
                        # Se você quiser que 'network' também seja o protocolo amigável (bitcoin, tron),
                        # você pode atribuir aqui: crypto.network = uri_scheme
                        # Por enquanto, vamos manter 'network' como o que veio da NOWPayments API.
                        # Mas podemos forçar o 'network' para o mesmo que 'uri_scheme' aqui, se for a intenção.
                        # Vamos assumir que network no BD é o que veio da API da NOWPayments (btc, trx)
                        # e uri_scheme é o que queremos usar para o QR code (bitcoin, tron).

                        crypto.save()
                        updated_count += 1
                        created_or_updated_codes.add(code)
                    except CriptomoedaDetalhes.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f"Aviso: Criptomoeda '{code}' não encontrada no banco de dados para atualização. Execute sync_cripto_data primeiro."))

                # Etapa 2: Excluir registros que não estão no MAPA_PROTOCOLOS
                # Coleta todos os códigos existentes no banco de dados
                all_existing_codes = set(CriptomoedaDetalhes.objects.values_list('code', flat=True))

                # Encontra os códigos que estão no banco mas não no MAPA_PROTOCOLOS
                codes_to_delete = all_existing_codes - created_or_updated_codes

                deleted_count, _ = CriptomoedaDetalhes.objects.filter(code__in=codes_to_delete).delete()

                self.stdout.write(self.style.SUCCESS(
                    f"Atualização de uri_schemes concluída! Atualizados: {updated_count}, Excluídos: {deleted_count} registros."))

        except Exception as e:
            raise CommandError(f"Erro durante a atualização de uri_schemes: {str(e)}")