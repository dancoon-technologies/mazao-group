from rest_framework import serializers
from schedules.models import Schedule
from visits.models import Visit


class VisitSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visit
        fields = [
            'id', 'officer', 'farmer', 'farm', 'latitude', 'longitude',
            'photo', 'notes', 'distance_from_farmer', 'verification_status',
            'activity_type', 'crop_stage', 'germination_percent', 'survival_rate',
            'pests_diseases', 'order_value', 'harvest_kgs', 'farmers_feedback',
            'created_at', 'updated_at', 'is_deleted',
        ]


class ScheduleSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            'id', 'officer', 'farmer', 'scheduled_date', 'notes',
            'status', 'created_by', 'approved_by', 'created_at', 'updated_at', 'is_deleted'
        ]
