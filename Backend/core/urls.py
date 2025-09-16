"""
URL configuration for hands project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from vista02.views import views as v2views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('vista01/', include('vista01.urls')),
    path('vista02/', include('vista02.urls.urls')),
    # ===== Fallbacks de API (por si el proxy quita el prefijo '/vista02/api/') =====
    path('predict', v2views.predict, name='v2_predict_fallback'),
    path('samples/batch', v2views.samples_batch, name='v2_samples_batch_fallback'),
    path('train', v2views.train_model, name='v2_train_fallback'),
    path('progress', v2views.progress, name='v2_progress_fallback'),
    path('model', v2views.get_model, name='v2_model_fallback'),
    path('reset', v2views.reset_data, name='v2_reset_fallback'),
    path('reset-letter', v2views.reset_letter, name='v2_reset_letter_fallback'),
    path('last-detected', v2views.last_detected, name='v2_last_detected_fallback'),
]
