# core/urls.py
from django.urls import path
from .views import *

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('api/user-status/', UserStatusAPIView.as_view(), name='api_user_status'), # NOVO
]