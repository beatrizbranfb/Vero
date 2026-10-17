from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    path("register/", views.register_, name="register"),
    path("login/", views.login_, name="login"),
    path("logout/", views.logout_, name="logout"),
    path("home/", views.home_, name="home"),  # depois do login, redireciona pra ca
]
