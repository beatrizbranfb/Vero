from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    search_fields = ("noUsuario", "nuTelefone")
    list_filter = ("icWhatsAppAtivo", "dhCriacao")
    list_display = (
        "idUsuario",
        "noUsuario",
        "nuTelefone",
        "icWhatsAppAtivo",
        "dhCriacao",
    )
