from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlanningVersionViewSet, BenchmarkViewSet, ProjectViewSet

router = DefaultRouter()
router.register(r'versions', PlanningVersionViewSet, basename='planning-version')
router.register(r'benchmarks', BenchmarkViewSet, basename='benchmark')
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
]
