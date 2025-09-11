from django.urls import path
from . import views

app_name = 'vista01'

urlpatterns = [
    path('', views.frontend_view, name='frontend'),
    path('guardar-resultado/', views.guardar_resultado_mano, name='guardar_resultado_mano'),
    path('estadisticas/', views.estadisticas_deteccion, name='estadisticas_deteccion'),
]
