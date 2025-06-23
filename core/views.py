# core/views.py
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.views.generic import View # Para usar View base para post
import json

class LoginView(View):
    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('pdv') # Redireciona para o PDV se já estiver logado
        return render(request, 'core/login.html')

    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return JsonResponse({'message': 'Login bem-sucedido!', 'username': user.username}, status=200)
        else:
            return JsonResponse({'error': 'Nome de usuário ou senha inválidos.'}, status=400)

class LogoutView(View):
    def post(self, request, *args, **kwargs):
        logout(request)
        return JsonResponse({'message': 'Logout bem-sucedido!'}, status=200)

class UserStatusAPIView(View):
    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return JsonResponse({'is_authenticated': True, 'username': request.user.username}, status=200)
        else:
            return JsonResponse({'is_authenticated': False}, status=200)

def custom_404_view(request, exception):
    if request.user.is_authenticated:
        # Usuário logado: redireciona para a home (PDV)
        return redirect('pdv')
    else:
        # Usuário deslogado: redireciona para a página de login
        return redirect('login')