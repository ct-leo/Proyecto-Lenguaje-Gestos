from django.apps import AppConfig


class Vista01Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vista01'
    
    def ready(self):
        """
        Inicialización de Mediapipe para el reconocimiento de manos
        cuando la aplicación Django esté lista
        """
        try:
            import mediapipe as mp
            
            # Inicializar Mediapipe Hands
            self.mp_hands = mp.solutions.hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=True,
                max_num_hands=1,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.5
            )
            self.mp_drawing = mp.solutions.drawing_utils
            
            # Almacenar instancias globalmente para uso en views
            import vista01.views
            vista01.views.mp_hands = self.mp_hands
            vista01.views.hands = self.hands
            vista01.views.mp_drawing = self.mp_drawing
            
        except ImportError:
            # Mediapipe no está instalado, se inicializará cuando sea necesario
            pass