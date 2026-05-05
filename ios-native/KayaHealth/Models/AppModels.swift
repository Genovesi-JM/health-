import Foundation

// MARK: - Patient Profile
struct PatientProfile: Codable, Identifiable {
    let id: Int
    let email: String
    let full_name: String?
    let date_of_birth: String?
    let gender: String?
    let blood_type: String?
    let allergies: [String]?
    let chronic_conditions: [String]?
    let emergency_contact_name: String?
    let emergency_contact_phone: String?
}

// MARK: - Dashboard State
struct PatientState: Decodable {
    let last_triage_risk: String?
    let last_triage_at: String?
    let total_triages: Int?
    let total_consultations: Int?
    let pending_consultations: Int?
    let upcoming_consultation: ConsultationItem?
}

// MARK: - Triage
struct TriageHistoryItem: Identifiable, Decodable {
    let id: String
    let created_at: String?
    let risk_level: String?
    let category: String?
    let complaint: String?
    let age_group: String?
    let recommendation: String?
    let specialist_referral: String?

    var displayRisk: String {
        switch risk_level?.uppercased() {
        case "URGENT": return "Urgente"
        case "HIGH": return "Alto"
        case "MEDIUM": return "Médio"
        case "LOW": return "Baixo"
        default: return risk_level ?? "—"
        }
    }
    var riskColor: String {
        switch risk_level?.uppercased() {
        case "URGENT": return "EF4444"
        case "HIGH": return "F97316"
        case "MEDIUM": return "EAB308"
        default: return "22C55E"
        }
    }
}

struct TriageResult: Decodable {
    let session_id: String?
    let risk_level: String?
    let recommendation: String?
    let specialist_referral: String?
    let follow_up_days: Int?
    let questions: [TriageQuestion]?
}

struct TriageQuestion: Identifiable, Decodable {
    let id: String
    let question_text: String?
    let question_key: String
    let question_type: String  // "boolean", "scale", "choice", "text"
    let options: [String]?
}

// MARK: - Consultation
struct ConsultationItem: Identifiable, Decodable {
    let id: String
    let specialty: String?
    let scheduled_at: String?
    let status: String?
    let doctor_name: String?
    let notes: String?

    var statusLabel: String {
        switch status {
        case "confirmed": return "Confirmada"
        case "pending": return "Pendente"
        case "completed": return "Concluída"
        case "cancelled": return "Cancelada"
        default: return status ?? "—"
        }
    }
    var statusColor: String {
        switch status {
        case "confirmed": return "22C55E"
        case "pending": return "EAB308"
        case "completed": return "6B7280"
        case "cancelled": return "EF4444"
        default: return "6B7280"
        }
    }
}

// MARK: - Family Member
struct FamilyMember: Identifiable, Decodable, Encodable {
    let id: Int
    let full_name: String
    let relationship: String?
    let date_of_birth: String?
    let is_minor: Bool?

    var initials: String { String(full_name.prefix(1)).uppercased() }
    var relationshipLabel: String {
        switch relationship?.lowercased() {
        case "son": return "Filho"
        case "daughter": return "Filha"
        case "mother", "mãe", "mae": return "Mãe"
        case "father", "pai": return "Pai"
        case "brother", "irmão": return "Irmão"
        case "sister", "irmã": return "Irmã"
        case "grandfather", "avô": return "Avô"
        case "grandmother", "avó": return "Avó"
        case "spouse", "cônjuge": return "Cônjuge"
        default: return relationship ?? "Familiar"
        }
    }
    var dependentId: String { String(id) }
}

// MARK: - Notification
struct NotificationItem: Identifiable, Decodable {
    let id: String
    let title: String?
    let message: String?
    let created_at: String?
    let is_read: Bool?
    let notification_type: String?
}

// MARK: - Reading (Measurement)
struct ReadingItem: Identifiable, Decodable {
    let id: String
    let reading_type: String
    let value_systolic: Double?
    let value_diastolic: Double?
    let value_numeric: Double?
    let unit: String?
    let recorded_at: String?
    let device_brand: String?
    let notes: String?

    var typeLabel: String {
        switch reading_type {
        case "blood_pressure": return "Pressão Arterial"
        case "glucose": return "Glicose"
        case "temperature": return "Temperatura"
        case "spo2": return "SpO₂"
        case "weight": return "Peso"
        case "heart_rate": return "Freq. Cardíaca"
        default: return reading_type
        }
    }
    var typeIcon: String {
        switch reading_type {
        case "blood_pressure": return "heart.fill"
        case "glucose": return "drop.fill"
        case "temperature": return "thermometer"
        case "spo2": return "lungs.fill"
        case "weight": return "scalemass.fill"
        case "heart_rate": return "waveform.path.ecg"
        default: return "chart.line.uptrend.xyaxis"
        }
    }
    var typeColor: String {
        switch reading_type {
        case "blood_pressure": return "EF4444"
        case "glucose": return "F97316"
        case "temperature": return "F59E0B"
        case "spo2": return "3B82F6"
        case "weight": return "8B5CF6"
        case "heart_rate": return "EC4899"
        default: return "6B7280"
        }
    }
    var displayValue: String {
        if reading_type == "blood_pressure", let s = value_systolic, let d = value_diastolic {
            return "\(Int(s))/\(Int(d)) mmHg"
        }
        if let v = value_numeric {
            return "\(v) \(unit ?? "")"
        }
        return "—"
    }
}

// MARK: - Medication
struct MedicationItem: Identifiable, Decodable {
    let id: String
    let medication_name: String
    let dosage: String?
    let frequency: String?
    let is_current: Bool?
    let reason: String?
}

// MARK: - Prescription
struct PrescriptionItem: Identifiable, Decodable {
    let id: String
    let medication_name: String?
    let dosage: String?
    let instructions: String?
    let prescribed_at: String?
    let status: String?
}
