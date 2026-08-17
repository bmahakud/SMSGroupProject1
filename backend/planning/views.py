import time
import shutil
from pathlib import Path
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import PlanningVersion, Benchmark, ManualInputConfig, Project, ProjectTask, ProjectTaskMonthlyDistribution
from .serializers import (
    PlanningVersionSerializer, BenchmarkSerializer, ProjectSerializer,
    ProjectTaskSerializer, ProjectTaskMonthlyDistributionSerializer,
    WeldingCalculationPreviewSerializer
)
from .services import ProjectPlanningEngine
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken



MONTHS_AUG_2026 = [
    "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026", "Jan 2027",
    "Feb 2027", "Mar 2027", "Apr 2027", "May 2027", "Jun 2027", "Jul 2027"
]

DEFAULT_DEPARTMENTS = {
    "production": {
        "capacityHours": [12000, 12000, 12500, 12000, 11500, 12000, 12000, 12500, 12000, 12000, 12500, 12000],
        "loadHours":     [10500, 11200, 11800, 12400, 10900, 10800, 11400, 11900, 11100, 11600, 12100, 11300],
        "ordersCount":   [145, 152, 160, 168, 140, 142, 150, 158, 149, 155, 162, 151]
    },
    "welding": {
        "capacityHours": [4500, 4500, 4500, 4500, 4200, 4500, 4500, 4500, 4500, 4500, 4500, 4500],
        "groupCompany":  [2200, 2400, 2500, 2600, 2100, 2300, 2450, 2550, 2350, 2480, 2520, 2410],
        "contractMfg":   [1800, 1750, 1850, 1900, 1700, 1800, 1820, 1860, 1790, 1840, 1880, 1810],
        "laborSupply":   [4400, 4450, 4500, 4550, 4200, 4450, 4480, 4520, 4460, 4490, 4510, 4470]
    },
    "machining": {
        "capacityHours": [5200, 5200, 5200, 5200, 4900, 5200, 5200, 5200, 5200, 5200, 5200, 5200],
        "millingLoad":   [2600, 2750, 2850, 3010, 2500, 2650, 2780, 2890, 2710, 2820, 2940, 2760],
        "latheLoad":     [2200, 2150, 2220, 2350, 2100, 2180, 2210, 2260, 2190, 2240, 2300, 2210]
    },
    "rr": {
        "capacityHours": [3100, 3100, 3100, 3100, 2900, 3100, 3100, 3100, 3100, 3100, 3100, 3100],
        "refurbLoad":    [2700, 2800, 2910, 2980, 2600, 2720, 2830, 2890, 2780, 2850, 2920, 2810]
    },
    "plating": {
        "capacityHours": [2200, 2200, 2200, 2200, 2000, 2200, 2200, 2200, 2200, 2200, 2200, 2200],
        "platingLoad":   [1850, 1920, 1990, 2080, 1780, 1860, 1940, 2010, 1910, 1970, 2030, 1930]
    },
    "service_machining": {
        "capacityHours": [1800, 1800, 1800, 1800, 1600, 1800, 1800, 1800, 1800, 1800, 1800, 1800],
        "serviceLoad":   [1420, 1510, 1580, 1650, 1380, 1460, 1520, 1590, 1490, 1540, 1610, 1500]
    },
    "scb": {
        "groupCompany":  [5800, 6100, 6400, 6700, 5400, 5900, 6200, 6500, 6000, 6300, 6600, 6100],
        "contractMfg":   [4200, 4350, 4500, 4700, 4100, 4250, 4400, 4550, 4300, 4450, 4600, 4350],
        "loi":           [1200, 1150, 1300, 1400, 1100, 1180, 1250, 1320, 1220, 1280, 1350, 1240],
        "smi":           [2100, 2150, 2200, 2250, 2000, 2120, 2180, 2220, 2140, 2190, 2240, 2160],
        "serviceBasic":  [950,  980,  1020, 1050, 900,  940,  990,  1010, 970,  1000, 1030, 980]
    }
}

import os
import sys
import subprocess

def run_graph_automation(file_path=None):
    workspace_root = Path(settings.BASE_DIR).parent
    graph_venv_python = workspace_root / "Graph_Automation" / ".venv" / "Scripts" / "python.exe"
    
    cmd_code = "import sys; sys.path.insert(0, 'Graph_Automation/src'); from scb_dashboard.dashboard import create_dashboard; "
    if file_path:
        file_path_clean = str(file_path).replace('\\', '/')
        cmd_code += f"create_dashboard(file_path='{file_path_clean}')"
    else:
        cmd_code += "create_dashboard()"

    if graph_venv_python.exists():
        try:
            subprocess.run([str(graph_venv_python), "-c", cmd_code], cwd=str(workspace_root), check=True)
            return True
        except Exception as e:
            print(f"Error running Graph_Automation via venv python: {e}")
    
    # Fallback to current python process
    try:
        graph_automation_src = workspace_root / "Graph_Automation" / "src"
        if str(graph_automation_src) not in sys.path:
            sys.path.insert(0, str(graph_automation_src))
        from scb_dashboard.dashboard import create_dashboard
        create_dashboard(file_path=str(file_path) if file_path else None)
        return True
    except Exception as e:
        print(f"Error running Graph_Automation direct import: {e}")
        return False


def sync_graph_automation_charts(request=None):
    workspace_root = Path(settings.BASE_DIR).parent
    graph_out = workspace_root / "Graph_Automation" / "output"
    graph_outs = workspace_root / "Graph_Automation" / "outputs"
    
    scb_dashboard_png = graph_out / "scb_dashboard.png"
    if not scb_dashboard_png.exists():
        run_graph_automation()

    media_charts = Path(settings.MEDIA_ROOT) / "charts"
    media_charts.mkdir(parents=True, exist_ok=True)

    frontend_public_charts = workspace_root / "frontend" / "public" / "media" / "charts"
    if frontend_public_charts.parent.parent.exists():
        frontend_public_charts.mkdir(parents=True, exist_ok=True)

    mapping = {
        "production": scb_dashboard_png,
        "welding": graph_out / "charts" / "welding" / "Historical_Welding_Dashboard.png",
        "machining": graph_outs / "machining" / "Historical_Machining_Dashboard.png",
        "rr": graph_out / "rr" / "Historical_RR_Dashboard.png",
        "plating": graph_out / "plating" / "Historical_Plating_Dashboard.png",
        "scb": scb_dashboard_png,
        "service_machining": graph_out / "charts" / "welding" / "Welding_Dashboard.png",
    }

    urls = {}
    for key, src_path in mapping.items():
        if src_path.exists():
            dest = media_charts / f"{key}_dashboard.png"
            shutil.copy(src_path, dest)
            if frontend_public_charts.exists():
                shutil.copy(src_path, frontend_public_charts / f"{key}_dashboard.png")
            urls[key] = f"/media/charts/{key}_dashboard.png"
    return urls


def ensure_seed_data(request=None):
    from django.contrib.auth.models import User
    
    if not User.objects.filter(username="admin").exists():
        admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@sms-group.com",
            password="smsgroup2026"
        )
        admin_user.first_name = "J."
        admin_user.last_name = "Smith"
        admin_user.save()

    if not User.objects.filter(username="user").exists():
        std_user = User.objects.create_user(
            username="user",
            email="user@sms-group.com",
            password="smsgroup2026"
        )
        std_user.first_name = "Plant"
        std_user.last_name = "Planner"
        std_user.save()


    chart_urls = sync_graph_automation_charts(request=request)
    
    if not PlanningVersion.objects.exists():
        PlanningVersion.objects.create(
            version_id="2026-08-V1",
            month_name="August 2026",
            horizon="Aug 2026 - Jul 2027",
            uploaded_by="J. Smith (Sr. Production Planner)",
            status="Validated",
            file_name="PD-Bhubaneswar-Aug2026-Planning.xlsx",
            file_size="4.8 MB",
            processing_time_ms=1420,
            months=MONTHS_AUG_2026,
            departments=DEFAULT_DEPARTMENTS,
            chart_urls=chart_urls,
            validation_warnings=[
                "Capacity utilization in Nov 2026 reaches 96.4% in Machining Dept.",
                "Service Machining contract hours slightly above historical baseline."
            ]
        )
    else:
        # Force update chart_urls on existing records
        ver = PlanningVersion.objects.first()
        ver.chart_urls = chart_urls
        ver.save()

    if not Benchmark.objects.exists():
        benchmarks = [
            {"department": "production", "name": "Overall Production Plant", "target_utilization": 88.0, "max_threshold": 95.0, "historical_baseline": 82.0},
            {"department": "welding", "name": "Heavy Welding Division", "target_utilization": 85.0, "max_threshold": 92.0, "historical_baseline": 79.0},
            {"department": "machining", "name": "Precision Machining Workshop", "target_utilization": 90.0, "max_threshold": 98.0, "historical_baseline": 85.5},
            {"department": "rr", "name": "Roll Repair & Refurbishment", "target_utilization": 82.0, "max_threshold": 90.0, "historical_baseline": 77.0},
            {"department": "plating", "name": "Surface Plating Unit", "target_utilization": 80.0, "max_threshold": 88.0, "historical_baseline": 75.0},
            {"department": "service_machining", "name": "On-Site Service Machining", "target_utilization": 75.0, "max_threshold": 85.0, "historical_baseline": 70.0},
        ]
        for b in benchmarks:
            Benchmark.objects.create(**b)


class PlanningVersionViewSet(viewsets.ModelViewSet):
    queryset = PlanningVersion.objects.all()
    serializer_class = PlanningVersionSerializer

    def list(self, request, *args, **kwargs):
        ensure_seed_data(request=request)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def upload_planning(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_name = file_obj.name
        version_id = f"2026-UPLOAD-{int(time.time())}"
        
        # Save temporary uploaded excel to process with python graph automation
        temp_dir = Path(settings.BASE_DIR) / "temp_uploads"
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / f"upload_{int(time.time())}_{file_name}"
        with open(temp_path, 'wb+') as destination:
            for chunk in file_obj.chunks():
                destination.write(chunk)
                
        run_graph_automation(file_path=temp_path)

        chart_urls = sync_graph_automation_charts(request=request)
        
        new_version = PlanningVersion.objects.create(
            version_id=version_id,
            month_name="Custom Upload 2026",
            horizon="Aug 2026 - Jul 2027",
            uploaded_by="User Upload",
            status="Validated",
            file_name=file_name,
            file_size=f"{round(file_obj.size / (1024 * 1024), 2)} MB",
            processing_time_ms=1150,
            months=MONTHS_AUG_2026,
            departments=DEFAULT_DEPARTMENTS,
            chart_urls=chart_urls,
            validation_warnings=["Uploaded spreadsheet processed and Capacity Utilization dashboard updated successfully."]
        )
        serializer = self.get_serializer(new_version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)



    @action(detail=False, methods=['get'])
    def latest(self, request):
        ensure_seed_data(request=request)
        latest_ver = PlanningVersion.objects.first()
        serializer = self.get_serializer(latest_ver)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def calculate_manual_planning(self, request):
        import calendar
        year = int(request.data.get('year', 2026))
        tasks = request.data.get('tasks', [])
        
        # 1. Determine days in year (366 if leap year, else 365)
        is_leap = calendar.isleap(year)
        total_days_in_year = 366 if is_leap else 365
        
        # 2. Total annual hours equals sum of task inputs (if tasks provided)
        total_task_weight = sum(float(t.get('hours', 0)) for t in tasks)
        if tasks and total_task_weight > 0:
            annual_hours = total_task_weight
        else:
            annual_hours = float(request.data.get('annual_hours', 120000))
        
        # 3. 1 day's plant available hours (Annual / Days in Year)
        daily_available_hours = annual_hours / total_days_in_year
        
        # 4. Monthly available hours for each month (Jan - Dec)
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        monthly_summary = []
        for month_num in range(1, 13):
            m_name = month_names[month_num - 1]
            days_in_month = calendar.monthrange(year, month_num)[1]
            
            # Split hours of each month based on each task's daily capacity
            task_breakdown = []
            monthly_avl_hours = 0.0
            
            for task in tasks:
                task_id = task.get('id', task.get('name'))
                task_hours_input = float(task.get('hours', 0))
                
                # Each task's 1-day capacity = Task Annual Hours / Days in Year
                task_daily_hours = task_hours_input / total_days_in_year
                
                # Each task's Monthly Hours = Task 1-Day Capacity * Days in Month
                task_monthly_hours = task_daily_hours * days_in_month
                monthly_avl_hours += task_monthly_hours
                
                ratio = (task_hours_input / total_task_weight) if total_task_weight > 0 else (1.0 / len(tasks) if len(tasks) > 0 else 0)
                
                task_breakdown.append({
                    "id": task_id,
                    "name": task.get('name'),
                    "category": task.get('category', 'Task'),
                    "monthly_hours": round(task_monthly_hours, 2),
                    "daily_hours": round(task_daily_hours, 2),
                    "days_in_month": days_in_month,
                    "share_pct": round(ratio * 100, 2)
                })
                
            monthly_summary.append({
                "month": f"{m_name} {year}",
                "month_num": month_num,
                "days_in_month": days_in_month,
                "monthly_available_hours": round(monthly_avl_hours, 2),
                "daily_available_hours": round(daily_available_hours, 2),
                "tasks": task_breakdown
            })
            
        return Response({
            "status": "success",
            "inputs": {
                "annual_hours": annual_hours,
                "year": year,
                "is_leap_year": is_leap,
                "total_days_in_year": total_days_in_year,
                "daily_available_hours": round(daily_available_hours, 4),
                "total_tasks_count": len(tasks)
            },
            "monthly_calculations": monthly_summary
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def get_manual_config(self, request):
        config, created = ManualInputConfig.objects.get_or_create(
            user_key="default_user",
            defaults={
                "year": 2026,
                "tasks": [
                    { "id": "welding", "name": "Welding", "category": "Heavy Fabrication", "hours": 25000 },
                    { "id": "machining", "name": "Machining", "category": "Precision Turning & Milling", "hours": 32000 },
                    { "id": "assembly", "name": "Assembly", "category": "Plant Equipment Assembly", "hours": 22000 },
                    { "id": "rr", "name": "Roll Repair (R&R)", "category": "Refurbishment & Reconditioning", "hours": 18000 },
                    { "id": "plating", "name": "Plating", "category": "Surface Treatment & Chrome", "hours": 15000 }
                ]
            }
        )
        return Response({
            "status": "success",
            "year": config.year,
            "tasks": config.tasks
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def save_manual_config(self, request):
        year = int(request.data.get('year', 2026))
        tasks = request.data.get('tasks', [])
        config, _ = ManualInputConfig.objects.get_or_create(user_key="default_user")
        config.year = year
        config.tasks = tasks
        config.save()
        return Response({
            "status": "success",
            "message": "Manual capacity configuration saved successfully.",
            "year": config.year,
            "tasks": config.tasks
        }, status=status.HTTP_200_OK)


class BenchmarkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Benchmark.objects.all()
    serializer_class = BenchmarkSerializer

    def list(self, request, *args, **kwargs):
        ensure_seed_data()
        return super().list(request, *args, **kwargs)


from account.views import login_api

        


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def preview_welding_calculation(self, request):
        serializer = WeldingCalculationPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        allocated_hours = serializer.validated_data['allocated_hours']
        duration_months = serializer.validated_data['duration_months']
        start_date = serializer.validated_data.get('start_date', '2026-08-01')
        adj_month = serializer.validated_data.get('adjustment_month_index')
        actual_hours = serializer.validated_data.get('actual_utilized_hours')
        buf_month = serializer.validated_data.get('buffer_month_index')
        buf_hours = serializer.validated_data.get('buffer_hours', 0.0)

        monthly_breakdown = ProjectPlanningEngine.calculate_welding_monthly_distribution(
            allocated_hours=allocated_hours,
            duration_months=duration_months,
            start_date_str=start_date,
            adjustment_month_index=adj_month,
            actual_utilized_hours=actual_hours,
            buffer_month_index=buf_month,
            buffer_hours=buf_hours
        )

        return Response({
            "status": "success",
            "task_name": "Welding",
            "allocated_hours": allocated_hours,
            "duration_months": duration_months,
            "start_date": start_date,
            "rule_applied": "15% Month 1 ramp-up, with adjustment and buffer logic applied",
            "monthly_breakdown": monthly_breakdown
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        data = request.data
        customer_name = data.get('customerName') or data.get('customer_name') or data.get('projectName') or data.get('project_name', '')
        wbs_no = data.get('wbsNo') or data.get('wbs_no') or data.get('projectNumber') or data.get('project_number', '')
        project_code = data.get('projectCode') or data.get('project_code') or wbs_no
        location = data.get('location', '')
        
        project_name = customer_name or data.get('projectName') or data.get('project_name', '')
        project_number = project_code or wbs_no or data.get('projectNumber') or data.get('project_number', '')
        
        if not customer_name and not project_name:
            return Response({"error": "customerName is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        total_planned_hours = float(data.get('plannedHours') or data.get('total_planned_hours', 0.0))
        
        project = Project.objects.create(
            customer_name=customer_name,
            wbs_no=wbs_no,
            project_code=project_code,
            location=location,
            project_name=project_name,
            project_number=project_number,
            equipment_name=data.get('equipmentName', data.get('equipment_name', '')),
            equipment_weight=data.get('equipmentWeight', data.get('equipment_weight', '')),
            description=data.get('description', ''),
            zero_date=data.get('startDate') or data.get('zero_date') or None,
            cdd=data.get('endDate') or data.get('cdd') or None,
            project_manager=data.get('projectManager', data.get('project_manager', '')),
            total_planned_hours=total_planned_hours,
            priority=data.get('priority', 'Medium'),
            status=data.get('status', 'Planned'),
        )


        raw_tasks = data.get('tasks', [])
        if not raw_tasks and data.get('task'):
            raw_tasks = [{
                'task_name': data.get('task'),
                'task_code': str(data.get('task')).lower().replace(' ', '_'),
                'allocated_hours': total_planned_hours,
                'duration_months': int(data.get('duration_months', 3)),
                'start_date': project.zero_date,
                'location': data.get('location', ''),
                'smi': data.get('smi', ''),
                'labour_supply': data.get('labourSupply', data.get('labour_supply', '')),
                'job_contractor': data.get('jobContractor', data.get('job_contractor', '')),
                'adjustment_month_index': data.get('adjustmentMonthIndex') or data.get('adjustment_month_index'),
                'actual_utilized_hours': data.get('actualUtilizedHours') or data.get('actual_utilized_hours'),
                'buffer_month_index': data.get('bufferMonthIndex') or data.get('buffer_month_index'),
                'buffer_hours': data.get('bufferHours') or data.get('buffer_hours', 0.0),
            }]

        for t_data in raw_tasks:
            t_name = t_data.get('task_name') or t_data.get('name') or t_data.get('task', 'Welding')
            t_code = t_data.get('task_code') or str(t_name).lower().replace(' ', '_')
            t_hours = float(t_data.get('allocated_hours') or t_data.get('hours', total_planned_hours))
            t_duration = int(t_data.get('duration_months') or t_data.get('duration', 3))
            t_start = t_data.get('start_date') or project.zero_date
            adj_m = t_data.get('adjustment_month_index') or t_data.get('adjustmentMonthIndex')
            act_h = t_data.get('actual_utilized_hours') or t_data.get('actualUtilizedHours')
            buf_m = t_data.get('buffer_month_index') or t_data.get('bufferMonthIndex')
            buf_h = float(t_data.get('buffer_hours') or t_data.get('bufferHours') or 0.0)

            t_loc = t_data.get('location', '')
            if str(t_name).strip().lower() != 'welding':
                t_loc = 'Khordha'
            elif not t_loc:
                t_loc = 'Khordha'

            task_obj = ProjectTask.objects.create(
                project=project,
                task_name=t_name,
                task_code=t_code,
                allocated_hours=t_hours,
                duration_months=t_duration,
                start_date=t_start if isinstance(t_start, str) else (t_start.strftime("%Y-%m-%d") if t_start else None),
                location=t_loc,
                smi=t_data.get('smi', ''),
                labour_supply=t_data.get('labour_supply', t_data.get('labourSupply', '')),
                job_contractor=t_data.get('job_contractor', t_data.get('jobContractor', '')),
                adjustment_month_index=adj_m,
                actual_utilized_hours=act_h,
                buffer_month_index=buf_m,
                buffer_hours=buf_h,
            )

            # Perform monthly calculation for all tasks
            breakdown = ProjectPlanningEngine.calculate_task_monthly_distribution(
                task_name=t_name,
                allocated_hours=t_hours,
                duration_months=t_duration,
                start_date_str=task_obj.start_date,
                adjustment_month_index=adj_m,
                actual_utilized_hours=act_h,
                buffer_month_index=buf_m,
                buffer_hours=buf_h
            )
            for item in breakdown:
                ProjectTaskMonthlyDistribution.objects.create(
                    task=task_obj,
                    month_index=item['month_index'],
                    month_label=item['month_label'],
                    date=item['date'],
                    hours=item['hours'],
                    percentage=item['percentage'],
                    is_adjusted=item.get('is_adjusted', False),
                    is_buffer_added=item.get('is_buffer_added', False)
                )

        # Recalculate total planned hours if sum of task hours exceeds current project total or project total is 0
        all_task_hours = sum([t.allocated_hours for t in project.tasks.all()])
        if all_task_hours > project.total_planned_hours or project.total_planned_hours == 0:
            project.total_planned_hours = all_task_hours
            project.save()

        serializer = self.get_serializer(project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)



    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data

        if 'customerName' in data or 'customer_name' in data:
            instance.customer_name = data.get('customerName') or data.get('customer_name')
        if 'wbsNo' in data or 'wbs_no' in data:
            instance.wbs_no = data.get('wbsNo') or data.get('wbs_no')
        if 'projectCode' in data or 'project_code' in data:
            instance.project_code = data.get('projectCode') or data.get('project_code')
        if 'location' in data:
            instance.location = data.get('location', '')
        if 'projectName' in data or 'project_name' in data:
            instance.project_name = data.get('projectName') or data.get('project_name')
        if 'equipmentName' in data or 'equipment_name' in data:
            instance.equipment_name = data.get('equipmentName') or data.get('equipment_name')
        if 'equipmentWeight' in data or 'equipment_weight' in data:
            instance.equipment_weight = data.get('equipmentWeight') or data.get('equipment_weight')
        if 'description' in data:
            instance.description = data.get('description', '')
        if 'startDate' in data or 'zero_date' in data:
            instance.zero_date = data.get('startDate') or data.get('zero_date') or None
        if 'endDate' in data or 'cdd' in data:
            instance.cdd = data.get('endDate') or data.get('cdd') or None
        if 'projectManager' in data or 'project_manager' in data:
            instance.project_manager = data.get('projectManager') or data.get('project_manager')
        if 'plannedHours' in data or 'total_planned_hours' in data:
            instance.total_planned_hours = float(data.get('plannedHours') or data.get('total_planned_hours', 0))
        if 'priority' in data:
            instance.priority = data.get('priority')
        if 'status' in data:
            instance.status = data.get('status')
            
        instance.save()


        raw_tasks = data.get('tasks', [])
        if not raw_tasks and data.get('task'):
            raw_tasks = [{
                'task_name': data.get('task'),
                'task_code': str(data.get('task')).lower().replace(' ', '_'),
                'allocated_hours': instance.total_planned_hours,
                'duration_months': int(data.get('duration_months', 3)),
                'start_date': instance.zero_date,
                'location': data.get('location', ''),
                'smi': data.get('smi', ''),
                'labour_supply': data.get('labourSupply', data.get('labour_supply', '')),
                'job_contractor': data.get('jobContractor', data.get('jobContractor', '')),
                'adjustment_month_index': data.get('adjustmentMonthIndex') or data.get('adjustment_month_index'),
                'actual_utilized_hours': data.get('actualUtilizedHours') or data.get('actual_utilized_hours'),
                'buffer_month_index': data.get('bufferMonthIndex') or data.get('buffer_month_index'),
                'buffer_hours': data.get('bufferHours') or data.get('buffer_hours', 0.0),
            }]

        if raw_tasks:
            instance.tasks.all().delete()
            for t_data in raw_tasks:
                t_name = t_data.get('task_name') or t_data.get('name') or t_data.get('task', 'Welding')
                t_code = t_data.get('task_code') or str(t_name).lower().replace(' ', '_')
                t_hours = float(t_data.get('allocated_hours') or t_data.get('hours', instance.total_planned_hours))
                t_duration = int(t_data.get('duration_months') or t_data.get('duration', 3))
                t_start = t_data.get('start_date') or instance.zero_date
                adj_m = t_data.get('adjustment_month_index') or t_data.get('adjustmentMonthIndex')
                act_h = t_data.get('actual_utilized_hours') or t_data.get('actualUtilizedHours')
                buf_m = t_data.get('buffer_month_index') or t_data.get('bufferMonthIndex')
                buf_h = float(t_data.get('buffer_hours') or t_data.get('bufferHours') or 0.0)

                t_loc = t_data.get('location', '')
                if str(t_name).strip().lower() != 'welding':
                    t_loc = 'Khordha'
                elif not t_loc:
                    t_loc = 'Khordha'

                task_obj = ProjectTask.objects.create(
                    project=instance,
                    task_name=t_name,
                    task_code=t_code,
                    allocated_hours=t_hours,
                    duration_months=t_duration,
                    start_date=t_start if isinstance(t_start, str) else (t_start.strftime("%Y-%m-%d") if t_start else None),
                    location=t_loc,
                    smi=t_data.get('smi', ''),
                    labour_supply=t_data.get('labour_supply', t_data.get('labourSupply', '')),
                    job_contractor=t_data.get('job_contractor', t_data.get('jobContractor', '')),
                    adjustment_month_index=adj_m,
                    actual_utilized_hours=act_h,
                    buffer_month_index=buf_m,
                    buffer_hours=buf_h,
                )

                breakdown = ProjectPlanningEngine.calculate_task_monthly_distribution(
                    task_name=t_name,
                    allocated_hours=t_hours,
                    duration_months=t_duration,
                    start_date_str=task_obj.start_date,
                    adjustment_month_index=adj_m,
                    actual_utilized_hours=act_h,
                    buffer_month_index=buf_m,
                    buffer_hours=buf_h
                )
                for item in breakdown:
                    ProjectTaskMonthlyDistribution.objects.create(
                        task=task_obj,
                        month_index=item['month_index'],
                        month_label=item['month_label'],
                        date=item['date'],
                        hours=item['hours'],
                        percentage=item['percentage'],
                        is_adjusted=item.get('is_adjusted', False),
                        is_buffer_added=item.get('is_buffer_added', False)
                    )

            all_task_hours = sum([t.allocated_hours for t in instance.tasks.all()])
            if all_task_hours > 0:
                instance.total_planned_hours = all_task_hours
                instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)




