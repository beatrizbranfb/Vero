from uuid import uuid4

from django.db import models


# Create your models here.
class User(models.Model):
    idUsuario = models.UUIDField(primary_key=True, default=uuid4(), editable=False)

    noUsuario = models.CharField(max_length=255)
    nuTelefone = models.CharField(max_length=255, unique=True)
    hashUsuario = models.CharField(max_length=255)

    nuTentativas = models.IntegerField(default=0)
    dhBloqueio = models.DateTimeField(blank=True, null=True)
    nuDiasAlerta = models.IntegerField(default=0)
    icAudioAtivado = models.BooleanField(default=True)
    icWhatsAppAtivo = models.BooleanField(default=True)

    dhCriacao = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return str(self.noUsuario)
