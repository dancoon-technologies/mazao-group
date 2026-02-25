"""
Single endpoint: GET /api/locations/
Returns all regions, counties, sub_counties for one fetch and cache on the client.
"""

import logging

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import County, Region, SubCounty
from .serializers import CountySerializer, RegionSerializer, SubCountySerializer

logger = logging.getLogger(__name__)


class LocationListView(APIView):
    """GET: { regions: [...], counties: [...], sub_counties: [...] }. No auth required for read."""

    permission_classes = [AllowAny]

    def get(self, request):
        logger.debug("GET /api/locations/")
        regions = Region.objects.all()
        counties = County.objects.select_related("region").all()
        sub_counties = SubCounty.objects.select_related("county").all()
        return Response(
            {
                "regions": RegionSerializer(regions, many=True).data,
                "counties": CountySerializer(counties, many=True).data,
                "sub_counties": SubCountySerializer(sub_counties, many=True).data,
            }
        )
