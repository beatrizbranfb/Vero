from django.contrib.auth.hashers import check_password, make_password
from django.http.request import HttpRequest
from django.shortcuts import redirect, render

from .models import User


def register_(request: HttpRequest):
    if request.method == "POST":
        name = request.POST.get("nome")
        phone_number = request.POST.get("telefone")
        raw_password = request.POST.get("senha")

        crypt_password = make_password(raw_password)

        user = User.objects.create(
            noUsuario=name, nuTelefone=phone_number, hashUsuario=crypt_password
        )
        request.session["user_id"] = str(user.idUsuario)
        return redirect("users:home")

    return render(request, "users/register.html")


def login_(request: HttpRequest):
    if request.method == "POST":
        phone_number = request.POST.get("telefone")
        password = request.POST.get("senha")

        try:
            user = User.objects.get(nuTelefone=phone_number)

            if check_password(password, user.hashUsuario):
                request.session["user_id"] = str(user.idUsuario)
                return redirect("users:home")
            else:
                error = "Senha incorreta. Tente novamente."
        except User.DoesNotExist:
            error = "Número de telefone nao cadastrado"

        return render(request, "users/login.html", {"error": error})

    return render(request, "users/login.html")


def logout_(request: HttpRequest):
    """remove a identificacao se existir e redireciona para tela de login"""
    if "user_id" in request.session:
        del request.session["user_id"]

    return redirect("users:login")


def home_(request: HttpRequest):
    user_id = request.session.get("user_id")
    if not user_id:
        return redirect("users:login")

    try:
        user = User.objects.get(idUsuario=user_id)
    except User.DoesNotExist:
        if "user_id" in request.session:
            del request.session["user_id"]
        return redirect("users:login")

    return render(request, "users/home.html", {"user": user})
