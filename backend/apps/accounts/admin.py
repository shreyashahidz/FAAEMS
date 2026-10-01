from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Department, FacultyProfile, User


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "is_active"]
    search_fields = ["name", "code"]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ["email", "full_name", "role", "department", "is_active", "mfa_enabled"]
    list_filter = ["role", "is_active", "mfa_enabled", "department"]
    search_fields = ["email", "full_name"]
    ordering = ["email"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role", "department")}),
        ("Security", {"fields": ("mfa_enabled", "mfa_secret", "failed_login_attempts", "locked_until")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "full_name", "role", "password1", "password2")}),
    )


@admin.register(FacultyProfile)
class FacultyProfileAdmin(admin.ModelAdmin):
    list_display = ["full_name", "department", "designation", "employee_id", "status"]
    list_filter = ["department", "designation", "status"]
    search_fields = ["full_name", "employee_id"]
