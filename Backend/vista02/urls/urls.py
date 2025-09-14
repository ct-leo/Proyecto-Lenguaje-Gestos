from django.urls import path
from ..views.views import (
    samples_batch,
    train_model,
    progress,
    get_model,
    last_detected,
    demo,
    reset_data,
    predict,
)

app_name = "vista02"

urlpatterns = [
    path("api/samples/batch", samples_batch, name="samples_batch"),
    path("api/train", train_model, name="train_model"),
    path("api/progress", progress, name="progress"),
    path("api/model", get_model, name="get_model"),
    path("api/last-detected", last_detected, name="last_detected"),
    path("api/reset", reset_data, name="reset_data"),
    path("api/predict", predict, name="predict"),
    path("demo/", demo, name="demo"),
]
