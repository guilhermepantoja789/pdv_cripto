# vendas/views.py
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime
from decimal import Decimal
import requests
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Sum, Count
from django.http import JsonResponse
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView
from dotenv import load_dotenv
from efipay import EfiPay, EfiPayError
from PDVCripto import settings
from estoque.models import MovimentoEstoque
from integracao_crypto.models import CriptomoedaDetalhes
from produtos.models import Produto
from vendas.models import ItemVenda, Venda, Caixa

load_dotenv()

class PdvView(LoginRequiredMixin, TemplateView):
    template_name = 'vendas/pdv.html'


class FinalizarVendaAPIView(LoginRequiredMixin, View):
    # NOVO: Adicionar LoginRequiredMixin para garantir que o usuário esteja logado
    def post(self, request, *args, **kwargs):
        # AQUI O USUÁRIO DEVE ESTAR LOGADO E UM CAIXA ABERTO PARA ELE
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Usuário não autenticado.'}, status=401)

        caixa_aberto = Caixa.objects.filter(usuario_abertura=request.user, status='ABERTO').first()
        if not caixa_aberto:
            return JsonResponse({
                                    'error': 'Nenhum caixa aberto encontrado para este usuário. Por favor, abra o caixa antes de realizar vendas.'},
                                status=400)

        try:
            data = json.loads(request.body)

            cart_items = data.get('itens', [])
            forma_pagamento = data.get('forma_pagamento')
            total_bruto = Decimal(str(data.get('total_bruto', '0.00')))
            desconto = Decimal(str(data.get('desconto', '0.00')))
            total_liquido = Decimal(str(data.get('total_liquido', '0.00')))
            transacao_id_provedor = data.get('transacao_id_provedor', None)  # Pode ser None

            if not cart_items:
                return JsonResponse({'error': 'Carrinho vazio. Não há itens para vender.'}, status=400)

            if not forma_pagamento:
                return JsonResponse({'error': 'Forma de pagamento não especificada.'}, status=400)

            with transaction.atomic():
                # 1. Criar a Venda
                venda = Venda.objects.create(
                    total_bruto=total_bruto,
                    desconto=desconto,
                    total_liquido=total_liquido,
                    forma_pagamento=forma_pagamento,
                    transacao_id_provedor=transacao_id_provedor,
                    vendedor=request.user,  # NOVO: Atribui o usuário logado como vendedor
                    caixa=caixa_aberto  # NOVO: Atribui o caixa aberto
                )

                # 2. Processar cada item do carrinho (restante do código da venda)
                for item_data in cart_items:
                    produto_id = item_data.get('id')
                    quantidade_vendida = Decimal(str(item_data.get('quantity')))
                    preco_unitario = Decimal(str(item_data.get('unitPrice')))

                    try:
                        produto = Produto.objects.get(id=produto_id, ativo=True)
                    except Produto.DoesNotExist:
                        raise ValueError(f"Produto (ID: {produto_id}) não encontrado ou inativo.")

                    if produto.estoque < quantidade_vendida:
                        raise ValueError(
                            f"Estoque insuficiente para '{produto.nome}'. Disponível: {produto.estoque}, Tentando vender: {quantidade_vendida}")

                    ItemVenda.objects.create(
                        venda=venda,
                        produto=produto,
                        quantidade=quantidade_vendida,
                        preco_unitario=preco_unitario,
                        subtotal_item=(quantidade_vendida * preco_unitario)
                    )

                    produto.dar_baixa_estoque(quantidade_vendida)

                    MovimentoEstoque.objects.create(
                        produto=produto,
                        tipo_movimento='VENDA',
                        quantidade=quantidade_vendida,
                        observacao=f"Venda PDV #{venda.id}"
                    )

            return JsonResponse({'message': 'Venda finalizada com sucesso!', 'venda_id': venda.id}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos.'}, status=400)
        except ValueError as ve:
            return JsonResponse({'error': str(ve)}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado: {str(e)}'}, status=500)


class GerarPixAPIView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            valor = Decimal(str(data.get('valor', '0.00')))  # Valor da cobrança vindo do frontend
            descricao = data.get('descricao', 'Venda no PDV')

            if valor <= 0:
                return JsonResponse({'error': 'Valor do PIX deve ser maior que zero.'}, status=400)

            #txid_unico = str(uuid.uuid4()).replace('-', '')

            # 1. Configurar as credenciais para o SDK
            # As credenciais são carregadas do .env e acessíveis via settings.py
            # O SDK espera um dicionário com as configurações
            options = {
                "client_id": os.environ.get('EFIPAY_CLIENT_ID'),
                "client_secret": os.environ.get('EFIPAY_CLIENT_SECRET'),
                "certificate": os.environ.get('EFIPAY_CERTIFICATE_PATH'),
                "sandbox": False, # Defina como True para ambiente de homologação
                # Ou False para produção.
                # O SDK pode ter um parâmetro 'production' ou 'homologation'
                # Verifique a documentação do SDK se há um parâmetro específico para isso
                # Se você definiu EFIPAY_API_BASE_URL no .env, pode passar para o SDK se ele aceitar
                # ou o SDK pode já inferir o ambiente pela URL
            }
            # Se você usa a URL base no .env e quer que o SDK use essa URL
            # Para o SDK da EFI/Gerencianet, geralmente o 'sandbox' True/False já define a URL base
            # mas alguns SDKs permitem passar a URL diretamente:
            # options["base_url"] = settings.EFIPAY_API_BASE_URL
            # Verifique a documentação do SDK para ver como configurar o ambiente (sandbox/producao)

            # Para o SDK da Efipay, é comum configurar o ambiente assim:
            # if "https://api-h.gerencianet.com.br" in settings.EFIPAY_API_BASE_URL:  # Ou outra forma de identificar homologação
            #     options["sandbox"] = True
            # else:
            #     options["sandbox"] = False  # Produção

            # 2. Inicializar o cliente da Efipay
            # O SDK cuidará da autenticação (obtenção do token) e do certificado
            efipay = EfiPay(options)

            # 3. Preparar o payload para criar a cobrança PIX
            # O txid é opcional para POST /v2/cob, a Efipay gera um se não fornecido.
            # É importante para rastreamento depois.

            # Gerar um txid único para sua referência (opcional, Efipay pode gerar)
            # ou usar o ID da venda que será gerado (se já soubermos)
            # Para testes, podemos usar um UUID temporário ou apenas deixar a Efipay gerar

            # Você pode passar um txid customizado se quiser, mas a Efipay tb gera um.
            # txid_gerado_app = "VENDA" + str(uuid.uuid4()).replace('-', '')[:20] # Exemplo de TXID customizado

            body = {
                "calendario": {
                    "expiracao": 600  # 1 hora (3600 segundos) para a cobrança expirar
                },
                "valor": {
                    "original": f"{valor:.2f}"  # Formata o Decimal para string com 2 casas decimais
                },
                "chave": os.environ.get('CHAVE_PIX'),  # ATENÇÃO: Substitua pela sua chave PIX real cadastrada na Efipay
                # Esta chave deve ser configurada em um local seguro (settings.py ou .env)
                "solicitacaoPagador": descricao, # Descrição para o cliente ver no extrato
                #"txid": txid_unico
            }

            # Se quiser passar dados do devedor (cliente do PDV), adicione aqui:
            # body["devedor"] = {
            #     "cpf": "12345678909", # CPF do cliente (se tiver)
            #     "nome": "Nome do Cliente"
            # }

            #print(f"DEBUG: Enviando payload para Efipay SDK: {json.dumps(body, indent=2)}")

            response_efi = efipay.pix_create_immediate_charge(body=body)

            # 5. Processar a resposta da Efipay
            if 'loc' in response_efi and 'location' in response_efi['loc'] and 'pixCopiaECola' in response_efi:
                qr_code_url = response_efi['loc']['location']  # URL da imagem do QR Code
                codigo_copia_cola = response_efi['pixCopiaECola']
                txid_efi = response_efi['txid']  # ID da transação gerado pela Efipay
                status_cobranca = response_efi['status']  # Status inicial da cobrança (ATIVA)

                return JsonResponse({
                    'qr_code_url': qr_code_url,
                    'codigo_copia_cola': codigo_copia_cola,
                    'status_pagamento': status_cobranca,
                    'transacao_id_provedor': txid_efi
                }, status=200)
            else:
                # Se a estrutura da resposta não for a esperada
                return JsonResponse({'error': 'Resposta inesperada da Efipay', 'details': response_efi}, status=500)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos na requisição.'}, status=400)
        except Exception as e:
            # Captura erros do SDK ou outros erros de lógica
            return JsonResponse({'error': f'Erro ao gerar PIX com Efipay: {str(e)}'}, status=500)


class ConsultarPixStatusAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        txid = request.GET.get('txid', None)

        if not txid:
            return JsonResponse({'error': 'ID da transação (txid) não fornecido.'}, status=400)

        options = {
            "client_id": os.environ.get('EFIPAY_CLIENT_ID'),
            "client_secret": os.environ.get('EFIPAY_CLIENT_SECRET'),
            "certificate": os.environ.get('EFIPAY_CERTIFICATE_PATH'),
            "sandbox": False,  # Defina como True para ambiente de homologação
            # Ou False para produção.
            # O SDK pode ter um parâmetro 'production' ou 'homologation'
            # Verifique a documentação do SDK se há um parâmetro específico para isso
            # Se você definiu EFIPAY_API_BASE_URL no .env, pode passar para o SDK se ele aceitar
            # ou o SDK pode já inferir o ambiente pela URL
        }

        # if hasattr(settings,
        #            'EFIPAY_API_BASE_URL') and "https://api-h.gerencianet.com.br" in settings.EFIPAY_API_BASE_URL:
        #     options["sandbox"] = True
        # else:
        #     options["sandbox"] = False

        try:
            efipay = EfiPay(options)

            # Chama o método do SDK para detalhar a cobrança (GET /v2/cob/:txid)
            # O SDK pode ter um método como pix_detail_charge ou similar
            # Verifique a documentação do SDK se o nome é diferente
            params = {'txid': txid}
            response_efi = efipay.pix_detail_charge(params=params)  # Método para consultar detalhes da cobrança

            status_cobranca = response_efi.get('status')

            return JsonResponse({
                'txid': txid,
                'status': status_cobranca,
                'detalhes': response_efi  # Retorna a resposta completa da Efipay para depuração
            }, status=200)

        except EfiPayError as e:
            print(f"Erro Efipay (Consulta Status): {e.code} - {e.error}")
            return JsonResponse({
                                    'error': f"Erro Efipay ao consultar status: {e.error['nome'] if 'nome' in e.error else 'Desconhecido'}",
                                    'details': e.error.get('mensagem', str(e))}, status=e.code)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado ao consultar status PIX: {str(e)}'}, status=500)


class GerarCriptoAPIView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            price_amount = Decimal(str(data.get('valor', '0.00')))
            pay_currency = data.get('criptomoeda_destino', settings.NOWPAYMENTS_DEFAULT_PAY_CURRENCY)
            order_description = data.get('descricao', 'Venda PDV Cripto')

            price_currency = settings.NOWPAYMENTS_DEFAULT_PRICE_CURRENCY

            order_id = str(uuid.uuid4())  # Gera um ID único para order_id

            if price_amount <= 0:
                return JsonResponse({'error': 'Valor do pagamento deve ser maior que zero.'}, status=400)

            headers = {
                'x-api-key': settings.NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json'
            }

            request_body = {
                "price_amount": float(price_amount),  # NOWPayments espera float
                "price_currency": price_currency,
                "pay_currency": pay_currency,
                "order_id": order_id,
                "order_description": order_description,
                # "ipn_callback_url": "https://seudominio.com/webhook", # Opcional, mantenha comentado
            }

            response_np = requests.post(
                f"{settings.NOWPAYMENTS_API_BASE_URL}payment",
                json=request_body,
                headers=headers
            )
            response_data_np = response_np.json()

            # Processar a Resposta da NOWPayments
            # A condição DEVE ser verdadeira se houver sucesso 2xx E o payment_id estiver presente
            if response_np.ok and response_data_np.get('payment_id'):
                response_to_frontend = {
                    'payment_id': response_data_np.get('payment_id'),
                    'payment_status': response_data_np.get('payment_status'),
                    'pay_address': response_data_np.get('pay_address'),
                    'price_amount': response_data_np.get('price_amount'),
                    'pay_amount': response_data_np.get('pay_amount'),
                    'payment_url': response_data_np.get('payment_url'),
                    'order_id': response_data_np.get('order_id'),
                    'is_fee_included': response_data_np.get('is_fee_included', False),
                    'network_precision': response_data_np.get('network_precision'),
                    'pay_currency': response_data_np.get('pay_currency')
                }
                # --- DEBUGGING: Verifique a resposta que sua view enviará para o frontend ---
                print(f"\n--- DEBUG Frontend Response (SUCESSO) ---")
                print(f"Sending to Frontend: {json.dumps(response_to_frontend, indent=2)}")
                print(f"--- FIM DEBUG Frontend (SUCESSO) ---\n")

                return JsonResponse(response_to_frontend, status=200)  # Retorna 200 OK para o frontend

            else:
                # Se a resposta da NOWPayments não for ok (não 2xx) OU não tiver payment_id
                error_message = response_data_np.get('message', 'Erro desconhecido da NOWPayments')
                print(f"\n--- DEBUG Frontend Response (ERRO) ---")
                print(
                    f"Erro detalhado da NOWPayments (não .ok ou sem payment_id): {error_message} - {response_data_np}")
                print(f"--- FIM DEBUG Frontend (ERRO) ---\n")

                # Use o status code que veio da NOWPayments se for um erro claro
                # Se não foi OK, use o status code da NOWPayments, caso contrário, 400
                status_code_for_frontend = response_np.status_code if not response_np.ok else 400
                return JsonResponse({'error': f'Erro NOWPayments: {error_message}', 'details': response_data_np},
                                    status=status_code_for_frontend)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos na requisição.'}, status=400)
        except requests.exceptions.RequestException as e:
            print(f"DEBUG: Erro de conexão ou requisição HTTP para NOWPayments: {e}")
            if e.response is not None:
                print(f"DEBUG: Status Code: {e.response.status_code}, Resposta Bruta: {e.response.text}")
                try:
                    error_data = e.response.json()
                    return JsonResponse({
                                            'error': f'Erro NOWPayments API ({e.response.status_code}): {error_data.get("message", "Desconhecido")}',
                                            'details': error_data}, status=e.response.status_code)
                except json.JSONDecodeError:
                    return JsonResponse({'error': f'Erro NOWPayments API ({e.response.status_code}): {e.response.text}',
                                         'details': str(e)}, status=e.response.status_code)
            return JsonResponse({'error': f'Erro de conexão ao NOWPayments: {str(e)}'}, status=500)
        except Exception as e:
            print(f"DEBUG: Erro inesperado no GerarCriptoAPIView: {e}")
            return JsonResponse({'error': f'Erro inesperado ao gerar pagamento cripto: {str(e)}'}, status=500)


class ConsultarCriptoStatusAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        # Para NOWPayments, o ID da transação é 'payment_id'
        payment_id = request.GET.get('payment_id', None)

        if not payment_id:
            return JsonResponse({'error': 'ID do pagamento (payment_id) não fornecido.'}, status=400)

        try:

            # # --- DEBUGGING: Verificando Credenciais NOWPayments ---
            # print(f"\n--- DEBUG ListarCriptosAPIView ---")
            # print(
            #     f"NOWPAYMENTS_API_KEY: '{settings.NOWPAYMENTS_API_KEY[:5]}...' (Length: {len(settings.NOWPAYMENTS_API_KEY) if settings.NOWPAYMENTS_API_KEY else 'None'})")
            # print(f"NOWPAYMENTS_API_BASE_URL: '{settings.NOWPAYMENTS_API_BASE_URL}'")
            # # --- FIM DEBUGGING ---

            # Cabeçalhos da Requisição NOWPayments (API Key)
            headers = {
                'x-api-key': settings.NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json'  # GET também precisa de Content-Type as vezes
            }

            # Fazer a Requisição GET para NOWPayments
            response_np = requests.get(
                f"{settings.NOWPAYMENTS_API_BASE_URL}payment/{payment_id}",  # URL do endpoint de status
                headers=headers
            )
            response_data_np = response_np.json()

            # Processar a Resposta da NOWPayments
            if response_np.status_code == 200 and response_data_np.get('payment_id'):
                status_pagamento = response_data_np.get('payment_status')

                return JsonResponse({
                    'payment_id': payment_id,
                    'status': status_pagamento,
                    'detalhes': response_data_np  # Retorna a resposta completa da NOWPayments
                }, status=200)
            else:
                error_message = response_data_np.get('message', 'Erro desconhecido da NOWPayments')
                return JsonResponse(
                    {'error': f'Erro NOWPayments ao consultar status: {error_message}', 'details': response_data_np},
                    status=response_np.status_code)

        except requests.exceptions.RequestException as e:
            print(f"DEBUG: Erro de requisição em ListarCriptosAPIView: {e}")  # Adicionar esse print também
            if e.response is not None:
                print(f"DEBUG: Resposta bruta da API de listar criptos: {e.response.text}")
            return JsonResponse({'error': f'Erro de conexão ao NOWPayments: {str(e)}'}, status=500)
        except Exception as e:
            print(f"DEBUG: Erro geral em ListarCriptosAPIView: {e}")  # Adicionar esse print também
            return JsonResponse({'error': f'Erro inesperado ao consultar status cripto: {str(e)}'}, status=500)


# CLASSE ADAPTADA: API para Listar Criptomoedas (Lê do BANCO DE DADOS LOCAL)
class ListarCriptosAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        try:
            # Não faz mais requisição para NOWPayments aqui!
            # Lê os dados do seu banco de dados local
            all_cryptos = CriptomoedaDetalhes.objects.all()

            currencies_list_for_frontend = []
            for crypto_obj in all_cryptos:
                currencies_list_for_frontend.append({
                    'code': crypto_obj.code,
                    'name': crypto_obj.name,
                    'min_amount': str(crypto_obj.min_amount),  # Converte Decimal para string para JSON
                    'max_amount': str(crypto_obj.max_amount),  # Converte Decimal para string para JSON
                    'status': crypto_obj.status,
                    'is_fiat': crypto_obj.is_fiat,
                    'network': crypto_obj.network,  # Agora temos o campo network vindo do BD
                })

            return JsonResponse({'currencies': currencies_list_for_frontend}, status=200)

        except Exception as e:
            print(f"DEBUG: Erro ao listar criptos do banco de dados: {e}")
            return JsonResponse({'error': f'Erro inesperado ao listar criptos do banco de dados: {str(e)}'}, status=500)


class AbrirCaixaAPIView(LoginRequiredMixin, View):  # Garante que só usuários logados acessem
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            saldo_inicial = Decimal(str(data.get('saldo_inicial', '0.00')))

            if saldo_inicial < 0:
                return JsonResponse({'error': 'Saldo inicial não pode ser negativo.'}, status=400)

            # Verifica se já existe um caixa aberto para este usuário
            caixa_aberto = Caixa.objects.filter(usuario_abertura=request.user, status='ABERTO').first()
            if caixa_aberto:
                return JsonResponse({'error': f'Já existe um caixa aberto (ID: {caixa_aberto.id}) para este usuário.'},
                                    status=400)

            # Cria a nova sessão de caixa
            with transaction.atomic():
                caixa = Caixa.objects.create(
                    usuario_abertura=request.user,
                    saldo_inicial=saldo_inicial,
                    status='ABERTO'
                )

            return JsonResponse({
                'message': 'Caixa aberto com sucesso!',
                'caixa_id': caixa.id,
                'saldo_inicial': str(caixa.saldo_inicial),
                'data_abertura': caixa.data_abertura.isoformat()
            }, status=201)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado ao abrir caixa: {str(e)}'}, status=500)


# NOVO: API para Fechar uma Sessão de Caixa
class FecharCaixaAPIView(LoginRequiredMixin, View):  # Garante que só usuários logados acessem
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            saldo_final = Decimal(str(data.get('saldo_final', '0.00')))

            if saldo_final < 0:
                return JsonResponse({'error': 'Saldo final não pode ser negativo.'}, status=400)

            # Encontra o caixa aberto para este usuário
            caixa = Caixa.objects.filter(usuario_abertura=request.user, status='ABERTO').first()
            if not caixa:
                return JsonResponse({'error': 'Nenhum caixa aberto encontrado para este usuário.'}, status=400)

            # Atualiza e fecha a sessão de caixa
            with transaction.atomic():
                caixa.saldo_final = saldo_final
                caixa.data_fechamento = timezone.now()  # NOVO: Precisamos importar timezone
                caixa.status = 'FECHADO'
                caixa.save()

            return JsonResponse({
                'message': 'Caixa fechado com sucesso!',
                'caixa_id': caixa.id,
                'saldo_final': str(caixa.saldo_final),
                'data_fechamento': caixa.data_fechamento.isoformat()
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dados JSON inválidos.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado ao fechar caixa: {str(e)}'}, status=500)


class ConsultarCaixaStatusAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        caixa_aberto = Caixa.objects.filter(usuario_abertura=request.user, status='ABERTO').first()
        if caixa_aberto:
            return JsonResponse({
                'status': 'ABERTO',
                'caixa_id': caixa_aberto.id,
                'saldo_inicial': str(caixa_aberto.saldo_inicial),
                'data_abertura': caixa_aberto.data_abertura.isoformat()
            }, status=200)
        else:
            return JsonResponse({'status': 'FECHADO'}, status=200)


class ResumoVendasAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        # Parâmetros de filtro
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        forma_pagamento = request.GET.get('forma_pagamento')  # Opcional

        vendas = Venda.objects.all()

        # Filtrar por período de data
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                vendas = vendas.filter(data_hora__date__gte=start_date)
            except ValueError:
                return JsonResponse({'error': 'Formato de data inicial inválido (YYYY-MM-DD).'}, status=400)

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                vendas = vendas.filter(data_hora__date__lte=end_date)
            except ValueError:
                return JsonResponse({'error': 'Formato de data final inválido (YYYY-MM-DD).'}, status=400)

        # Filtro por forma de pagamento
        if forma_pagamento and forma_pagamento != 'todos':
            vendas = vendas.filter(forma_pagamento=forma_pagamento.upper())

        # Agregação de dados
        resumo = vendas.aggregate(
            total_vendas_liquido=Sum('total_liquido'),
            total_descontos=Sum('desconto'),
            total_itens_vendidos=Sum('itens__quantidade'),  # Soma a quantidade de todos os itens de venda
            total_transacoes=Count('id')
        )

        # Resumo por forma de pagamento
        vendas_por_forma_pagamento = vendas.values('forma_pagamento').annotate(
            total_liquido=Sum('total_liquido'),
            num_transacoes=Count('id')
        ).order_by('-total_liquido')

        # Retorna 0 se os campos forem nulos (sem vendas no período)
        total_vendas_liquido = resumo['total_vendas_liquido'] if resumo['total_vendas_liquido'] else Decimal('0.00')
        total_descontos = resumo['total_descontos'] if resumo['total_descontos'] else Decimal('0.00')
        total_itens_vendidos = resumo['total_itens_vendidos'] if resumo['total_itens_vendidos'] else Decimal('0.00')

        return JsonResponse({
            'total_vendas_liquido': str(total_vendas_liquido),
            'total_descontos': str(total_descontos),
            'total_itens_vendidos': str(total_itens_vendidos),
            'total_transacoes': resumo['total_transacoes'],
            'detalhes_por_forma_pagamento': list(vendas_por_forma_pagamento)
        }, status=200)


# NOVO: API de Produtos Mais Vendidos
class ProdutosMaisVendidosAPIView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        limit = int(request.GET.get('limit', 10))  # Limite de produtos (top 10 por padrão)

        itens_venda = ItemVenda.objects.all()

        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                itens_venda = itens_venda.filter(venda__data_hora__date__gte=start_date)
            except ValueError:
                return JsonResponse({'error': 'Formato de data inicial inválido (YYYY-MM-DD).'}, status=400)

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                itens_venda = itens_venda.filter(venda__data_hora__date__lte=end_date)
            except ValueError:
                return JsonResponse({'error': 'Formato de data final inválido (YYYY-MM-DD).'}, status=400)

        # Agrupar por produto e somar a quantidade vendida
        produtos_vendidos = itens_venda.values('produto__nome', 'produto__codigo_barras',
                                               'produto__unidade_medida').annotate(
            total_quantidade_vendida=Sum('quantidade'),
            total_valor_vendido=Sum('subtotal_item')
        ).order_by('-total_quantidade_vendida')[:limit]  # Ordena e limita

        return JsonResponse({'produtos_mais_vendidos': list(produtos_vendidos)}, status=200)


class DetalhesVendaAPIView(LoginRequiredMixin, View):
    def get(self, request, venda_id, *args, **kwargs):
        try:
            venda = Venda.objects.get(id=venda_id)

            # Garante que apenas o vendedor ou um superusuário possa ver os detalhes da venda
            if not request.user.is_superuser and venda.vendedor != request.user:
                return JsonResponse({'error': 'Você não tem permissão para ver os detalhes desta venda.'}, status=403)

            itens_venda_data = []
            for item in venda.itens.all():  # Assume related_name='itens' em ItemVenda
                itens_venda_data.append({
                    'produto_nome': item.produto.nome,
                    'produto_codigo_barras': item.produto.codigo_barras,
                    'quantidade': str(item.quantidade),
                    'unidade_medida': item.produto.unidade_medida,
                    'preco_unitario': str(item.preco_unitario),
                    'subtotal_item': str(item.subtotal_item)
                })

            # Dados do vendedor e caixa
            vendedor_username = venda.vendedor.username if venda.vendedor else 'N/A'
            caixa_id = venda.caixa.id if venda.caixa else 'N/A'
            caixa_saldo_inicial = str(
                venda.caixa.saldo_inicial) if venda.caixa and venda.caixa.saldo_inicial is not None else 'N/A'

            venda_data = {
                'id': venda.id,
                'data_hora': venda.data_hora.isoformat(),
                'total_bruto': str(venda.total_bruto),
                'desconto': str(venda.desconto),
                'total_liquido': str(venda.total_liquido),
                'forma_pagamento': venda.get_forma_pagamento_display(),  # Obtém o nome amigável
                'transacao_id_provedor': venda.transacao_id_provedor,
                'vendedor_username': vendedor_username,
                'caixa_id': caixa_id,
                'caixa_saldo_inicial': caixa_saldo_inicial,
                'itens': itens_venda_data
            }

            return JsonResponse(venda_data, status=200)

        except Venda.DoesNotExist:
            return JsonResponse({'error': 'Venda não encontrada.'}, status=404)
        except Exception as e:
            return JsonResponse({'error': f'Erro inesperado ao obter detalhes da venda: {str(e)}'}, status=500)
