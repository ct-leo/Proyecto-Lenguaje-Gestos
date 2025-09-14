from django.db import models

"""
This app now uses a models package at `vista02/models/`.
Expose those models here so Django's default import path `vista02.models`
continues to work without duplication.
"""

from .models import *  # noqa: F401,F403
