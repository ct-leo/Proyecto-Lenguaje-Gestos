from django.urls import path
from . import views

app_name = 'vista01'

urlpatterns = [
    path('reconocer/', views.reconocer_mano, name='reconocer_mano'),
    path('estadisticas/', views.estadisticas_deteccion, name='estadisticas_deteccion'),
]
