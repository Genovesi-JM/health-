import SwiftUI

// MARK: - Triage View
struct PatientTriagemView: View {
    @StateObject private var auth = AuthService.shared
    @StateObject private var vm = TriagemVM()
    @State private var tab: TriTab = .nova

    enum TriTab { case historico, nova }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Page header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Triagem Inteligente").font(.system(size: 22, weight: .heavy)).foregroundStyle(Color(hex: "101828"))
                    Text("Avaliação de sintomas com classificação automática de risco")
                        .font(.system(size: 13)).foregroundStyle(Color(hex: "667085"))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 12)

                // Tab switcher
                HStack(spacing: 0) {
                    tabBtn("Histórico", isActive: tab == .historico) { tab = .historico }
                    tabBtn("Nova Triagem", isActive: tab == .nova) { tab = .nova }
                }
                .background(.white)
                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)

                // Content
                if tab == .historico {
                    historicoContent
                } else {
                    novaContent
                }
            }
            .background(Color(hex: "F5F7FA").ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
            .task {
                guard let t = auth.token else { return }
                await vm.loadHistory(token: t)
                await vm.loadDependents(token: t)
            }
        }
    }

    private func tabBtn(_ label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Text(label)
                    .font(.system(size: 14, weight: isActive ? .bold : .medium))
                    .foregroundStyle(isActive ? Color(hex: "2D8C82") : Color(hex: "667085"))
                    .padding(.vertical, 12)
                Rectangle().fill(isActive ? Color(hex: "2D8C82") : .clear).frame(height: 2)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Histórico
    private var historicoContent: some View {
        ScrollView(showsIndicators: false) {
            if vm.isLoading {
                ProgressView().padding(.top, 60)
            } else if vm.history.isEmpty {
                emptyHistorico
            } else {
                VStack(spacing: 12) {
                    ForEach(vm.history) { item in TriageHistoryCard(item: item) }
                }
                .padding(.horizontal, 20).padding(.vertical, 20)
            }
        }
    }

    private var emptyHistorico: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform.path.ecg").font(.system(size: 44)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Sem triagens anteriores").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
            Text("As suas triagens aparecerão aqui.").font(.system(size: 13)).foregroundStyle(Color(hex: "9CA3AF"))
        }.frame(maxWidth: .infinity).padding(.top, 60)
    }

    // MARK: - Nova Triagem
    private var novaContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 16) {
                switch vm.step {
                case .start:   startForm
                case .result:  resultView
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 20)
        }
    }

    // MARK: Start Form
    private var startForm: some View {
        VStack(spacing: 16) {
            // Card wrapper
            VStack(alignment: .leading, spacing: 20) {
                Text("Descreva os seus sintomas")
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "101828"))

                // For whom selector
                forWhomSection

                // Age group
                ageGroupSection

                // Category
                categorySection

                // Complaint
                complaintSection

                // Vitals
                vitalsSection

                // Error
                if !vm.error.isEmpty {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill").foregroundStyle(.red)
                        Text(vm.error).font(.system(size: 13)).foregroundStyle(.red)
                    }
                }

                // Submit button
                Button {
                    Task { await vm.startTriage(token: auth.token ?? "") }
                } label: {
                    HStack(spacing: 8) {
                        Spacer()
                        if vm.isStarting {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "chevron.right").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                            Text("Iniciar Triagem").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                        }
                        Spacer()
                    }
                    .frame(height: 50)
                    .background(Color(hex: "2D8C82"))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(vm.isStarting || vm.complaint.isEmpty)
                .opacity(vm.complaint.isEmpty ? 0.6 : 1)
            }
            .padding(20)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
        }
    }

    // MARK: For Whom
    private var forWhomSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Para quem é a triagem?", systemImage: "person.2.fill")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    // Me
                    personChip(id: "me", name: "Para mim", subtitle: "Pessoal", icon: "person.fill", color: "2D8C82")
                    // Dependents
                    ForEach(vm.dependents) { dep in
                        personChip(id: dep.dependentId, name: dep.full_name.components(separatedBy: " ").first ?? dep.full_name,
                                   subtitle: dep.relationshipLabel, icon: nil, initial: dep.initials, color: "7C3AED")
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func personChip(id: String, name: String, subtitle: String, icon: String?, initial: String? = nil, color: String) -> some View {
        let selected = vm.selectedDependentId == id
        return Button { vm.selectedDependentId = id } label: {
            VStack(spacing: 6) {
                ZStack {
                    Circle().fill(selected ? Color(hex: color) : Color(hex: color).opacity(0.1)).frame(width: 48, height: 48)
                    if let icon = icon {
                        Image(systemName: icon).font(.system(size: 20)).foregroundStyle(selected ? .white : Color(hex: color))
                    } else if let initial = initial {
                        Text(initial).font(.system(size: 17, weight: .bold)).foregroundStyle(selected ? .white : Color(hex: color))
                    }
                }
                Text(name).font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(selected ? Color(hex: color) : Color(hex: "667085"))
                Text(subtitle).font(.system(size: 9)).foregroundStyle(Color(hex: "9CA3AF"))
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Age Group
    private var ageGroupSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Para quem é a triagem?").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
            HStack(spacing: 10) {
                ageBtn("Adulto", value: "adult")
                ageBtn("Criança", value: "pediatric")
            }
        }
    }

    private func ageBtn(_ label: String, value: String) -> some View {
        let selected = vm.ageGroup == value
        return Button { vm.ageGroup = value } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? .white : Color(hex: "374151"))
                .padding(.horizontal, 20).padding(.vertical, 9)
                .background(selected ? Color(hex: "2D8C82") : Color(hex: "F3F4F6"))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    // MARK: Category
    private let categories: [(String, String)] = [
        ("general", "Geral / Não sei"), ("respiratory", "Respiratório"), ("cardiac", "Cardíaco"),
        ("neuro", "Neurológico"), ("gi", "Gastrointestinal"), ("urinary", "Urinário"),
        ("skin", "Pele"), ("injury", "Lesão / Trauma"), ("mental", "Saúde Mental"),
        ("womens", "Saúde Feminina"), ("medication", "Medicação"), ("chronic", "Doença Crónica"),
    ]

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Categoria").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
            Menu {
                ForEach(categories, id: \.0) { key, label in
                    Button(label) { vm.category = key }
                }
            } label: {
                HStack {
                    Text(categories.first { $0.0 == vm.category }?.1 ?? "Geral / Não sei")
                        .font(.system(size: 14)).foregroundStyle(Color(hex: "101828"))
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 12)).foregroundStyle(Color(hex: "667085"))
                }
                .padding(12)
                .background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
            }
        }
    }

    // MARK: Complaint
    private var complaintSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Queixa Principal").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
            TextEditor(text: $vm.complaint)
                .font(.system(size: 14)).foregroundStyle(Color(hex: "101828"))
                .frame(height: 100)
                .padding(12)
                .background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                .overlay(
                    Group {
                        if vm.complaint.isEmpty {
                            Text("Descreva os sintomas que está a sentir…")
                                .font(.system(size: 14)).foregroundStyle(Color(hex: "9CA3AF"))
                                .padding(16)
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                                .allowsHitTesting(false)
                        }
                    }
                )
        }
    }

    // MARK: Vitals
    private var vitalsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "heart.fill").foregroundStyle(.red).font(.system(size: 12))
                Text("SINAIS VITAIS (OPCIONAL)").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: "667085"))
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(Color(hex: "FFF5F5")).clipShape(RoundedRectangle(cornerRadius: 10))

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                vitalField("Tensão sistólica (mmHg)", icon: "heart", color: "EF4444", text: $vm.systolic)
                vitalField("Tensão diastólica (mmHg)", icon: "heart", color: "EF4444", text: $vm.diastolic)
                vitalField("SpO₂ (%)", icon: "lungs.fill", color: "3B82F6", text: $vm.spo2)
                vitalField("Temperatura (°C)", icon: "thermometer", color: "F59E0B", text: $vm.temp)
            }
            vitalField("Glicémia (mg/dL)", icon: "drop.fill", color: "F97316", text: $vm.glucose)
        }
        .padding(14)
        .background(Color(hex: "F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "FECACA"), lineWidth: 1))
    }

    private func vitalField(_ label: String, icon: String, color: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 10)).foregroundStyle(Color(hex: color))
                Text(label).font(.system(size: 10, weight: .medium)).foregroundStyle(Color(hex: "667085")).lineLimit(1)
            }
            TextField("—", text: text)
                .keyboardType(.decimalPad)
                .font(.system(size: 14))
                .padding(8)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "E5E7EB"), lineWidth: 1))
        }
    }

    // MARK: Result
    private var resultView: some View {
        VStack(spacing: 16) {
            if let r = vm.result {
                // Risk header
                let rColor = riskColor(r.risk_level)
                VStack(spacing: 12) {
                    Image(systemName: riskIcon(r.risk_level))
                        .font(.system(size: 40)).foregroundStyle(Color(hex: rColor))
                    Text(riskLabel(r.risk_level))
                        .font(.system(size: 24, weight: .heavy)).foregroundStyle(Color(hex: rColor))
                    if let rec = r.recommendation {
                        Text(rec).font(.system(size: 14)).foregroundStyle(Color(hex: "374151"))
                            .multilineTextAlignment(.center).lineSpacing(3)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(Color(hex: rColor).opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(hex: rColor).opacity(0.2), lineWidth: 1.5))

                // Specialist
                if let spec = r.specialist_referral {
                    HStack(spacing: 10) {
                        Image(systemName: "stethoscope").foregroundStyle(Color(hex: "2D8C82"))
                        Text("Referenciado para: \(spec.capitalized)")
                            .font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: "101828"))
                        Spacer()
                    }
                    .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                }

                // Follow-up
                if let days = r.follow_up_days {
                    HStack(spacing: 10) {
                        Image(systemName: "calendar.badge.clock").foregroundStyle(Color(hex: "6366F1"))
                        Text("Seguimento em \(days) \(days == 1 ? "dia" : "dias")")
                            .font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: "101828"))
                        Spacer()
                    }
                    .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
                }

                // New triage
                Button {
                    vm.reset()
                } label: {
                    Label("Nova Triagem", systemImage: "arrow.counterclockwise")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(hex: "2D8C82"))
                        .frame(maxWidth: .infinity).padding(14)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: "2D8C82"), lineWidth: 1.5))
                }
            }
        }
    }

    private func riskColor(_ r: String?) -> String {
        switch r?.uppercased() {
        case "URGENT": return "EF4444"; case "HIGH": return "F97316"
        case "MEDIUM": return "EAB308"; default: return "22C55E"
        }
    }
    private func riskLabel(_ r: String?) -> String {
        switch r?.uppercased() {
        case "URGENT": return "Urgente"; case "HIGH": return "Alto"
        case "MEDIUM": return "Médio"; default: return "Baixo"
        }
    }
    private func riskIcon(_ r: String?) -> String {
        switch r?.uppercased() {
        case "URGENT": return "exclamationmark.triangle.fill"; case "HIGH": return "exclamationmark.circle.fill"
        case "MEDIUM": return "clock.fill"; default: return "checkmark.circle.fill"
        }
    }
}

// MARK: - Triage History Card
struct TriageHistoryCard: View {
    let item: TriageHistoryItem
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.spring(duration: 0.25)) { expanded.toggle() } } label: {
                HStack(spacing: 12) {
                    Circle().fill(Color(hex: item.riskColor).opacity(0.12)).frame(width: 44, height: 44)
                        .overlay(Image(systemName: "waveform.path.ecg").font(.system(size: 18)).foregroundStyle(Color(hex: item.riskColor)))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 8) {
                            Text(item.displayRisk).font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: item.riskColor))
                            if let cat = item.category {
                                Text(cat.capitalized).font(.system(size: 11)).foregroundStyle(Color(hex: "667085"))
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(Color(hex: "F3F4F6")).clipShape(Capsule())
                            }
                        }
                        if let at = item.created_at { Text(shortDate(at)).font(.system(size: 11)).foregroundStyle(Color(hex: "9CA3AF")) }
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: "9CA3AF"))
                }
                .padding(14)
            }
            .buttonStyle(.plain)

            if expanded {
                Divider().padding(.horizontal, 14)
                VStack(alignment: .leading, spacing: 8) {
                    if let c = item.complaint {
                        detailRow(label: "Queixa", value: c)
                    }
                    if let r = item.recommendation {
                        detailRow(label: "Recomendação", value: r)
                    }
                    if let s = item.specialist_referral {
                        detailRow(label: "Especialista", value: s.capitalized)
                    }
                }
                .padding(14)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private func detailRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: "9CA3AF")).textCase(.uppercase)
            Text(value).font(.system(size: 13)).foregroundStyle(Color(hex: "374151")).lineSpacing(2)
        }
    }

    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) {
            let df = DateFormatter(); df.dateStyle = .long; df.timeStyle = .short; df.locale = Locale(identifier: "pt_PT")
            return df.string(from: d)
        }
        return iso
    }
}

// MARK: - Triage ViewModel
@MainActor
final class TriagemVM: ObservableObject {
    enum Step { case start, result }

    @Published var step: Step = .start
    @Published var ageGroup = "adult"
    @Published var category = "general"
    @Published var complaint = ""
    @Published var selectedDependentId = "me"
    @Published var dependents: [FamilyMember] = []
    @Published var history: [TriageHistoryItem] = []
    @Published var result: TriageResult?
    @Published var isLoading = false
    @Published var isStarting = false
    @Published var error = ""
    @Published var systolic = ""
    @Published var diastolic = ""
    @Published var spo2 = ""
    @Published var temp = ""
    @Published var glucose = ""

    func loadHistory(token: String) async {
        isLoading = true
        defer { isLoading = false }
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/triage/history", token: token)),
           let list = try? JSONDecoder().decode([TriageHistoryItem].self, from: data) {
            history = list
        }
    }

    func loadDependents(token: String) async {
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/family/", token: token)),
           let list = try? JSONDecoder().decode([FamilyMember].self, from: data) {
            dependents = list
        }
    }

    func startTriage(token: String) async {
        guard !complaint.isEmpty else { error = "Por favor descreva os seus sintomas."; return }
        isStarting = true; error = ""
        var body: [String: Any] = ["age_group": ageGroup, "category": category, "complaint": complaint]
        if selectedDependentId != "me" { body["dependent_id"] = selectedDependentId }
        var vitals: [String: Any] = [:]
        if let s = Double(systolic), let d = Double(diastolic) { vitals["systolic"] = s; vitals["diastolic"] = d }
        if let v = Double(spo2) { vitals["spo2"] = v }
        if let v = Double(temp) { vitals["temperature"] = v }
        if let v = Double(glucose) { vitals["glucose"] = v }
        if !vitals.isEmpty { body["vitals"] = vitals }

        var req = API.request("/api/v1/triage/start", method: "POST", token: token, body: body)
        if let (data, resp) = try? await URLSession.shared.data(for: req),
           (resp as? HTTPURLResponse)?.statusCode ?? 0 < 300,
           let r = try? JSONDecoder().decode(TriageResult.self, from: data) {
            result = r; step = .result
        } else {
            error = "Erro ao iniciar triagem. Tente novamente."
        }
        isStarting = false
    }

    func reset() {
        step = .start; complaint = ""; category = "general"; ageGroup = "adult"
        selectedDependentId = "me"; systolic = ""; diastolic = ""; spo2 = ""; temp = ""; glucose = ""
        error = ""; result = nil
    }
}
