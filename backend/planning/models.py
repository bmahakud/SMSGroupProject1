from django.db import models

class PlanningVersion(models.Model):
    version_id = models.CharField(max_length=64, unique=True)
    month_name = models.CharField(max_length=64)
    horizon = models.CharField(max_length=128)
    upload_date = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.CharField(max_length=128, default="J. Smith (Sr. Production Planner)")
    status = models.CharField(max_length=32, default="Validated")
    file_name = models.CharField(max_length=256)
    file_size = models.CharField(max_length=64, default="4.8 MB")
    processing_time_ms = models.IntegerField(default=1420)
    
    # Store complete structured JSON payload for dynamic frontend consumption
    months = models.JSONField(default=list)
    departments = models.JSONField(default=dict)
    chart_urls = models.JSONField(default=dict)
    validation_warnings = models.JSONField(default=list)

    class Meta:
        ordering = ['-upload_date']

    def __str__(self):
        return f"{self.version_id} ({self.month_name})"


class Benchmark(models.Model):
    department = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    target_utilization = models.FloatField(default=85.0)
    max_threshold = models.FloatField(default=95.0)
    historical_baseline = models.FloatField(default=78.5)
    description = models.TextField(blank=True, default="")

    def __str__(self):
        return str(self.name)


class ManualInputConfig(models.Model):
    user_key = models.CharField(max_length=64, default="default_user", unique=True)
    year = models.IntegerField(default=2026)
    tasks = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ManualInputConfig ({self.year})"


class CapacityPlan(models.Model):
    plan_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=256, default="Default Plan")
    year = models.IntegerField(default=2026)
    horizon = models.CharField(max_length=128, default="Aug 2026 - Jul 2027")
    tasks = models.JSONField(default=list)
    total_hours = models.FloatField(default=140000.0)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.year} - {self.total_hours} hrs)"


class Project(models.Model):
    customer_name = models.CharField(max_length=256, blank=True, default="")
    wbs_no = models.CharField(max_length=128, blank=True, default="")
    project_code = models.CharField(max_length=128, blank=True, default="")
    location = models.CharField(max_length=128, blank=True, default="")
    project_name = models.CharField(max_length=256, blank=True, default="")
    project_number = models.CharField(max_length=128, blank=True, default="")
    equipment_name = models.CharField(max_length=256, blank=True, default="")
    equipment_weight = models.CharField(max_length=128, blank=True, default="")
    description = models.TextField(blank=True, default="")
    zero_date = models.DateField(null=True, blank=True)
    cdd = models.DateField(null=True, blank=True)
    project_manager = models.CharField(max_length=128, blank=True, default="")
    total_planned_hours = models.FloatField(default=0.0)
    priority = models.CharField(max_length=32, default="Medium")
    status = models.CharField(max_length=32, default="Planned")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        c_name = self.customer_name or self.project_name or 'Project'
        code = self.project_code or self.wbs_no or self.project_number or ''
        return f"{code} - {c_name}"



class ProjectTask(models.Model):
    project = models.ForeignKey(Project, related_name='tasks', on_delete=models.CASCADE)
    task_name = models.CharField(max_length=128)
    task_code = models.CharField(max_length=64, default="welding")
    allocated_hours = models.FloatField(default=0.0)
    duration_months = models.IntegerField(default=1)
    start_date = models.DateField(null=True, blank=True)
    
    # Task specific optional metadata
    location = models.CharField(max_length=128, blank=True, default="")
    smi = models.CharField(max_length=128, blank=True, default="")
    labour_supply = models.CharField(max_length=128, blank=True, default="")
    job_contractor = models.CharField(max_length=128, blank=True, default="")
    
    # Progress Adjustments & Buffers (Only introduced during Project Progress edit)
    adjustment_month_index = models.IntegerField(null=True, blank=True)
    actual_utilized_hours = models.FloatField(null=True, blank=True)
    buffer_month_index = models.IntegerField(null=True, blank=True)
    buffer_hours = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.project_number} | Task: {self.task_name} ({self.allocated_hours} hrs, {self.duration_months} mo)"


class ProjectTaskMonthlyDistribution(models.Model):
    task = models.ForeignKey(ProjectTask, related_name='monthly_distributions', on_delete=models.CASCADE)
    month_index = models.IntegerField(default=1)
    month_label = models.CharField(max_length=64)
    date = models.DateField(null=True, blank=True)
    hours = models.FloatField(default=0.0)
    percentage = models.FloatField(default=0.0)
    is_adjusted = models.BooleanField(default=False)
    is_buffer_added = models.BooleanField(default=False)

    class Meta:
        ordering = ['month_index']

    def __str__(self):
        return f"{self.task.task_name} - Month {self.month_index} ({self.month_label}): {self.hours} hrs ({self.percentage}%)"


class CapacityAdjustment(models.Model):
    department = models.CharField(max_length=100)
    year = models.IntegerField(default=2026)
    month = models.CharField(max_length=20)
    buffer_hours = models.FloatField(default=0)
    adjustment_hours = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('department', 'year', 'month')

    def __str__(self):
        return f"{self.department} - {self.month}"
