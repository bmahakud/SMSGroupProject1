from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import login_api, me_api, logout_api

urlpatterns = [
    path("login/", login_api, name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", me_api, name="token_verify_me"),
    path("logout/", logout_api, name="token_logout"),
]