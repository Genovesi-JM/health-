"""Add health platform models

Revision ID: health_platform_v1
Revises: production_hardening_v1
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'health_platform_v1'
down_revision = None  # Set to latest existing migration if chaining
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Patients ──
    op.create_table(
        'patients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('date_of_birth', sa.String(10), nullable=True),
        sa.Column('gender', sa.String(20), nullable=True),
        sa.Column('blood_type', sa.String(5), nullable=True),
        sa.Column('allergies_json', sa.Text, nullable=True, server_default='[]'),
        sa.Column('chronic_conditions_json', sa.Text, nullable=True, server_default='[]'),
        sa.Column('emergency_contact_name', sa.String(200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(30), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_patients_user_id', 'patients', ['user_id'])

    # ── Doctors ──
    op.create_table(
        'doctors',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('license_number', sa.String(100), nullable=False),
        sa.Column('specialization', sa.String(100), nullable=False, server_default='clinica_geral'),
        sa.Column('bio', sa.Text, nullable=True),
        sa.Column('verification_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('verified_at', sa.DateTime, nullable=True),
        sa.Column('verified_by', sa.String(36), nullable=True),
        sa.Column('document_url', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_doctors_user_id', 'doctors', ['user_id'])
    op.create_index('ix_doctors_verification_status', 'doctors', ['verification_status'])

    # ── Doctor Availability ──
    op.create_table(
        'doctor_availability',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('doctor_id', sa.String(36), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_of_week', sa.Integer, nullable=False),
        sa.Column('start_time', sa.String(5), nullable=False),
        sa.Column('end_time', sa.String(5), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index('ix_doctor_availability_doctor_id', 'doctor_availability', ['doctor_id'])

    # ── Triage Sessions ──
    op.create_table(
        'triage_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='in_progress'),
        sa.Column('chief_complaint', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_triage_sessions_patient_created', 'triage_sessions', ['patient_id', 'created_at'])

    # ── Triage Answers ──
    op.create_table(
        'triage_answers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('triage_session_id', sa.String(36), sa.ForeignKey('triage_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_key', sa.String(100), nullable=False),
        sa.Column('answer_value', sa.Text, nullable=False),
    )
    op.create_index('ix_triage_answers_session_id', 'triage_answers', ['triage_session_id'])

    # ── Triage Results ──
    op.create_table(
        'triage_results',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('triage_session_id', sa.String(36), sa.ForeignKey('triage_sessions.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('risk_level', sa.String(10), nullable=False),
        sa.Column('recommended_action', sa.String(20), nullable=False),
        sa.Column('reasoning_json', sa.Text, nullable=True, server_default='{}'),
        sa.Column('score', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Consultations ──
    op.create_table(
        'consultations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doctor_id', sa.String(36), sa.ForeignKey('doctors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('triage_session_id', sa.String(36), sa.ForeignKey('triage_sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('specialty', sa.String(100), nullable=False, server_default='clinica_geral'),
        sa.Column('status', sa.String(20), nullable=False, server_default='requested'),
        sa.Column('scheduled_at', sa.DateTime, nullable=True),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('ended_at', sa.DateTime, nullable=True),
        sa.Column('cancellation_reason', sa.String(500), nullable=True),
        sa.Column('payment_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('payment_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_consultations_patient_scheduled', 'consultations', ['patient_id', 'scheduled_at'])
    op.create_index('ix_consultations_doctor_scheduled', 'consultations', ['doctor_id', 'scheduled_at'])

    # ── Consultation Notes ──
    op.create_table(
        'consultation_notes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('consultation_id', sa.String(36), sa.ForeignKey('consultations.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('doctor_id', sa.String(36), nullable=False),
        sa.Column('subjective', sa.Text, nullable=True),
        sa.Column('objective', sa.Text, nullable=True),
        sa.Column('assessment', sa.Text, nullable=True),
        sa.Column('plan', sa.Text, nullable=True),
        sa.Column('outcome', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Prescriptions ──
    op.create_table(
        'prescriptions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('consultation_id', sa.String(36), sa.ForeignKey('consultations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('medications_json', sa.Text, nullable=False, server_default='[]'),
        sa.Column('instructions', sa.Text, nullable=True),
        sa.Column('file_url', sa.Text, nullable=True),
        sa.Column('file_storage_key', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_prescriptions_consultation_id', 'prescriptions', ['consultation_id'])

    # ── Referrals ──
    op.create_table(
        'referrals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('consultation_id', sa.String(36), sa.ForeignKey('consultations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('destination', sa.String(200), nullable=False),
        sa.Column('specialty', sa.String(100), nullable=True),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('urgency', sa.String(20), nullable=False, server_default='routine'),
        sa.Column('file_url', sa.Text, nullable=True),
        sa.Column('file_storage_key', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_referrals_consultation_id', 'referrals', ['consultation_id'])

    # ── Corporate Accounts ──
    op.create_table(
        'corporate_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('company_name', sa.String(200), nullable=False),
        sa.Column('tax_id', sa.String(50), nullable=True),
        sa.Column('contact_email', sa.String, nullable=False),
        sa.Column('contact_phone', sa.String(30), nullable=True),
        sa.Column('plan', sa.String(30), nullable=False, server_default='corporate'),
        sa.Column('max_employees', sa.Integer, nullable=False, server_default='50'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('admin_user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── Corporate Members ──
    op.create_table(
        'corporate_members',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('corporate_id', sa.String(36), sa.ForeignKey('corporate_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_code_hash', sa.String(128), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('enrolled_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_corporate_members_corporate_id', 'corporate_members', ['corporate_id'])

    # ── Patient Consents ──
    op.create_table(
        'patient_consents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('consent_type', sa.String(50), nullable=False),
        sa.Column('accepted_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
    )
    op.create_index('ix_patient_consents_patient_id', 'patient_consents', ['patient_id'])

    # ── Health Payments ──
    op.create_table(
        'health_payments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('patient_id', sa.String(36), nullable=True),
        sa.Column('corporate_id', sa.String(36), nullable=True),
        sa.Column('consultation_id', sa.String(36), nullable=True),
        sa.Column('payment_type', sa.String(30), nullable=False, server_default='consultation'),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('currency', sa.String(5), nullable=False, server_default='AOA'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('provider', sa.String(30), nullable=True),
        sa.Column('provider_reference', sa.String(200), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('metadata_json', sa.Text, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_health_payments_patient_id', 'health_payments', ['patient_id'])

    # ── Health Audit Logs ──
    op.create_table(
        'health_audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('actor_user_id', sa.String(36), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(36), nullable=True),
        sa.Column('metadata_json', sa.Text, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_health_audit_logs_created_at', 'health_audit_logs', ['created_at'])
    op.create_index('ix_health_audit_logs_actor', 'health_audit_logs', ['actor_user_id'])


def downgrade() -> None:
    op.drop_table('health_audit_logs')
    op.drop_table('health_payments')
    op.drop_table('patient_consents')
    op.drop_table('corporate_members')
    op.drop_table('corporate_accounts')
    op.drop_table('referrals')
    op.drop_table('prescriptions')
    op.drop_table('consultation_notes')
    op.drop_table('consultations')
    op.drop_table('triage_results')
    op.drop_table('triage_answers')
    op.drop_table('triage_sessions')
    op.drop_table('doctor_availability')
    op.drop_table('doctors')
    op.drop_table('patients')
