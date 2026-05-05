import SwiftUI

// MARK: - Alertas View
struct PatientAlertasView: View {
    @StateObject private var auth = AuthService.shared
    @State private var notifications: [NotificationItem] = []
    @State private var isLoading = true
    @State private var filter: NotiTab = .todas

    enum NotiTab: String, CaseIterable { case todas = "Todas"; case naoLidas = "Não lidas" }

    private var filtered: [NotificationItem] {
        switch filter {
        case .todas: return notifications
        case .naoLidas: return notifications.filter { $0.is_read != true }
        }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                // Header
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "bell.fill").foregroundStyle(Color(hex: "F59E0B"))
                        Text("Alertas & Notificações").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                    }
                    Spacer()
                    Button {
                        Task { await load() }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.clockwise").font(.system(size: 12))
                            Text("Actualizar").font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(Color(hex: "2D8C82"))
                    }
                }
                .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 14)

                Text("As suas notificações de saúde e actualizações de pedidos")
                    .font(.system(size: 13)).foregroundStyle(Color(hex: "667085"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20).padding(.bottom, 16)

                // Filter tabs
                HStack(spacing: 0) {
                    ForEach(NotiTab.allCases, id: \.self) { t in
                        Button {
                            withAnimation { filter = t }
                        } label: {
                            let count = t == .todas ? notifications.count : notifications.filter { $0.is_read != true }.count
                            HStack(spacing: 6) {
                                Text(t.rawValue).font(.system(size: 13, weight: filter == t ? .bold : .medium))
                                    .foregroundStyle(filter == t ? Color(hex: "2D8C82") : Color(hex: "667085"))
                                Text("(\(count))").font(.system(size: 12)).foregroundStyle(filter == t ? Color(hex: "2D8C82") : Color(hex: "9CA3AF"))
                            }
                            .padding(.horizontal, 16).padding(.vertical, 8)
                            .background(filter == t ? Color(hex: "2D8C82").opacity(0.08) : .clear)
                            .clipShape(Capsule())
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 16).padding(.bottom, 16)

                // Content
                if isLoading {
                    ProgressView().padding(.top, 60)
                } else if filtered.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 10) {
                        ForEach(filtered) { n in NotificationCard(item: n) }
                    }
                    .padding(.horizontal, 20)
                }

                Spacer(minLength: 40)
            }
        }
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
        .navigationTitle("Alertas")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle().fill(Color(hex: "F3F4F6")).frame(width: 72, height: 72)
                Image(systemName: "bell").font(.system(size: 28)).foregroundStyle(Color(hex: "9CA3AF"))
            }
            Text("Sem notificações").font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "374151"))
            Text("As suas notificações aparecerão aqui.").font(.system(size: 13)).foregroundStyle(Color(hex: "9CA3AF"))
        }
        .frame(maxWidth: .infinity).padding(.top, 60)
    }

    private func load() async {
        isLoading = true
        guard let t = auth.token else { isLoading = false; return }
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/notifications/", token: t)),
           let list = try? JSONDecoder().decode([NotificationItem].self, from: data) {
            notifications = list
        }
        isLoading = false
    }
}

struct NotificationCard: View {
    let item: NotificationItem
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(item.is_read == true ? Color(hex: "F3F4F6") : Color(hex: "2D8C82").opacity(0.1))
                    .frame(width: 40, height: 40)
                Image(systemName: typeIcon).font(.system(size: 16))
                    .foregroundStyle(item.is_read == true ? Color(hex: "9CA3AF") : Color(hex: "2D8C82"))
            }
            VStack(alignment: .leading, spacing: 4) {
                if let title = item.title {
                    Text(title).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                }
                if let msg = item.message {
                    Text(msg).font(.system(size: 13)).foregroundStyle(Color(hex: "667085")).lineSpacing(2)
                }
                if let at = item.created_at {
                    Text(shortDate(at)).font(.system(size: 11)).foregroundStyle(Color(hex: "9CA3AF"))
                }
            }
            Spacer()
            if item.is_read != true {
                Circle().fill(Color(hex: "2D8C82")).frame(width: 8, height: 8)
            }
        }
        .padding(14)
        .background(item.is_read == true ? Color(hex: "F9FAFB") : .white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(item.is_read == true ? 0.02 : 0.05), radius: 6, x: 0, y: 3)
    }

    private var typeIcon: String {
        switch item.notification_type {
        case "appointment": return "calendar.badge.clock"
        case "triage": return "waveform.path.ecg"
        case "prescription": return "pills.fill"
        case "alert": return "exclamationmark.triangle.fill"
        default: return "bell.fill"
        }
    }

    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) {
            let df = DateFormatter(); df.dateStyle = .medium; df.timeStyle = .short; df.locale = Locale(identifier: "pt_PT")
            return df.string(from: d)
        }
        return iso
    }
}

// MARK: - Medições View
struct PatientMedicoesView: View {
    @StateObject private var auth = AuthService.shared
    @State private var readings: [ReadingItem] = []
    @State private var isLoading = true
    @State private var showForm = false
    @State private var filter: ReadingType = .all
    @State private var readingType = "blood_pressure"
    @State private var systolic = ""; @State private var diastolic = ""
    @State private var numericVal = ""
    @State private var notes = ""
    @State private var deviceBrand = ""; @State private var deviceModel = ""
    @State private var isSaving = false

    enum ReadingType: String, CaseIterable {
        case all = "Todos"
        case blood_pressure = "Pressão Arterial"
        case glucose = "Glicose"
        case temperature = "Temperatura"
        case spo2 = "Saturação de Oxigénio"
        case weight = "Peso"
        case heart_rate = "Frequência Cardíaca"

        var apiKey: String { rawValue == "Todos" ? "all" : self == .blood_pressure ? "blood_pressure" : self.rawValue.lowercased().replacingOccurrences(of: " ", with: "_") }
    }

    private let readingTypes = [
        ("blood_pressure", "Pressão Arterial"), ("glucose", "Glicose"),
        ("temperature", "Temperatura"), ("spo2", "SpO₂"),
        ("weight", "Peso"), ("heart_rate", "Frequência Cardíaca"),
    ]

    private var filtered: [ReadingItem] {
        guard filter != .all else { return readings }
        return readings.filter { $0.reading_type == filter.rawValue }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Minhas Medições").font(.system(size: 22, weight: .heavy)).foregroundStyle(Color(hex: "101828"))
                    Text("Registe as leituras dos seus dispositivos de saúde em casa.")
                        .font(.system(size: 13)).foregroundStyle(Color(hex: "667085"))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 16)

                // New Measurement button (when form hidden)
                if !showForm {
                    Button { withAnimation { showForm = true } } label: {
                        Label("Nova Medição", systemImage: "plus.circle.fill")
                            .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(12)
                            .background(Color(hex: "2D8C82")).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal, 20).padding(.bottom, 16)
                }

                // Form card
                if showForm {
                    measurementForm.padding(.horizontal, 20).padding(.bottom, 16)
                }

                // Filter tabs
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(ReadingType.allCases, id: \.self) { t in
                            Button { withAnimation { filter = t } } label: {
                                Text(t.rawValue.components(separatedBy: " ").first ?? t.rawValue)
                                    .font(.system(size: 12, weight: filter == t ? .bold : .medium))
                                    .foregroundStyle(filter == t ? .white : Color(hex: "667085"))
                                    .padding(.horizontal, 14).padding(.vertical, 7)
                                    .background(filter == t ? Color(hex: "2D8C82") : Color(hex: "F3F4F6"))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 16)

                // List
                if isLoading {
                    ProgressView().padding(.top, 40)
                } else if filtered.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 10) {
                        ForEach(filtered) { r in ReadingCard(item: r) }
                    }
                    .padding(.horizontal, 20)
                }

                Spacer(minLength: 40)
            }
        }
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
        .navigationTitle("Medições")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var measurementForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Nova Medição").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(hex: "101828"))

            // Type picker
            VStack(alignment: .leading, spacing: 6) {
                Text("Tipo de Medição *").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
                Menu {
                    ForEach(readingTypes, id: \.0) { key, label in Button(label) { readingType = key } }
                } label: {
                    HStack {
                        Text(readingTypes.first { $0.0 == readingType }?.1 ?? "Tipo")
                            .font(.system(size: 14)).foregroundStyle(Color(hex: "101828"))
                        Spacer()
                        Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(Color(hex: "667085"))
                    }
                    .padding(12).background(Color(hex: "F9FAFB"))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                }
            }

            // Blood pressure fields
            if readingType == "blood_pressure" {
                HStack(spacing: 10) {
                    formField("Sistólica (mmHg) *", placeholder: "120", text: $systolic, keyboard: .numberPad)
                    formField("Diastólica (mmHg) *", placeholder: "80", text: $diastolic, keyboard: .numberPad)
                }
            } else {
                let unit = readingTypes.first { $0.0 == readingType }.map { "\($0.1) " } ?? ""
                formField("Valor *", placeholder: unit, text: $numericVal, keyboard: .decimalPad)
            }

            HStack(spacing: 10) {
                formField("Marca do Dispositivo", placeholder: "ex: Omron", text: $deviceBrand)
                formField("Modelo", placeholder: "ex: M3", text: $deviceModel)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Notas").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
                TextEditor(text: $notes)
                    .font(.system(size: 13)).frame(height: 70)
                    .padding(10).background(Color(hex: "F9FAFB"))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
            }

            HStack(spacing: 10) {
                Button { withAnimation { showForm = false; resetForm() } } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark").font(.system(size: 12, weight: .bold))
                        Text("Cancelar").font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color(hex: "667085")).frame(maxWidth: .infinity).padding(12)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                }
                Button {
                    Task { await saveReading() }
                } label: {
                    HStack {
                        if isSaving { ProgressView().tint(.white).scaleEffect(0.8) }
                        else { Text("Guardar Medição").font(.system(size: 13, weight: .bold)).foregroundStyle(.white) }
                    }
                    .frame(maxWidth: .infinity).padding(12)
                    .background(Color(hex: "2D8C82")).clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(isSaving)
            }
        }
        .padding(18).background(.white).clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }

    private func formField(_ label: String, placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
            TextField(placeholder, text: text)
                .keyboardType(keyboard).font(.system(size: 14))
                .padding(10).background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform.path.ecg").font(.system(size: 40)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Sem medições registadas").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
            Text("Clique em Nova Medição para registar a sua primeira leitura.")
                .font(.system(size: 13)).foregroundStyle(Color(hex: "9CA3AF")).multilineTextAlignment(.center)
        }
        .padding(.top, 50)
    }

    private func load() async {
        isLoading = true
        guard let t = auth.token else { isLoading = false; return }
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/readings/", token: t)),
           let list = try? JSONDecoder().decode([ReadingItem].self, from: data) {
            readings = list
        }
        isLoading = false
    }

    private func saveReading() async {
        guard let t = auth.token else { return }
        isSaving = true
        var body: [String: Any] = ["reading_type": readingType]
        if readingType == "blood_pressure" {
            if let s = Double(systolic) { body["value_systolic"] = s }
            if let d = Double(diastolic) { body["value_diastolic"] = d }
        } else {
            if let v = Double(numericVal) { body["value_numeric"] = v }
        }
        if !notes.isEmpty { body["notes"] = notes }
        if !deviceBrand.isEmpty { body["device_brand"] = deviceBrand }
        if let (_, resp) = try? await URLSession.shared.data(for: API.request("/api/v1/readings/", method: "POST", token: t, body: body)),
           (resp as? HTTPURLResponse)?.statusCode ?? 0 < 300 {
            resetForm(); withAnimation { showForm = false }
            await load()
        }
        isSaving = false
    }

    private func resetForm() {
        systolic = ""; diastolic = ""; numericVal = ""; notes = ""; deviceBrand = ""; deviceModel = ""
    }
}

struct ReadingCard: View {
    let item: ReadingItem
    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12).fill(Color(hex: item.typeColor).opacity(0.1))
                .frame(width: 44, height: 44)
                .overlay(Image(systemName: item.typeIcon).font(.system(size: 18)).foregroundStyle(Color(hex: item.typeColor)))
            VStack(alignment: .leading, spacing: 3) {
                Text(item.typeLabel).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                Text(item.displayValue).font(.system(size: 16, weight: .heavy)).foregroundStyle(Color(hex: item.typeColor))
                if let at = item.recorded_at { Text(shortDate(at)).font(.system(size: 11)).foregroundStyle(Color(hex: "9CA3AF")) }
            }
            Spacer()
            if let brand = item.device_brand {
                Text(brand).font(.system(size: 11)).foregroundStyle(Color(hex: "9CA3AF"))
            }
        }
        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
    }
    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) {
            let df = DateFormatter(); df.dateStyle = .short; df.timeStyle = .short; df.locale = Locale(identifier: "pt_PT")
            return df.string(from: d)
        }
        return iso
    }
}
