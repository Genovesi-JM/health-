import SwiftUI

// MARK: - Dashboard View (Visão Geral)
struct DashboardView: View {
    @StateObject private var auth = AuthService.shared
    @State private var state: PatientState?
    @State private var triages: [TriageHistoryItem] = []
    @State private var consultations: [ConsultationItem] = []
    @State private var isLoading = true
    @State private var activeTab: DashTab = .resumo
    @State private var showBooking = false

    enum DashTab: String, CaseIterable {
        case resumo = "Resumo"
        case triagens = "Triagens"
        case consultas = "Consultas"
        case perfil = "Perfil"
    }

    private let quickActions: [(icon: String, label: String, color: String, bg: String)] = [
        ("waveform.path.ecg", "Triagem", "0D9488", "E0F7F5"),
        ("calendar.badge.plus", "Consultas", "2563EB", "DBEAFE"),
        ("pills.fill", "Medicação", "7C3AED", "EDE9FE"),
        ("video.fill", "eConsulta", "059669", "D1FAE5"),
        ("stethoscope", "Médicos", "DC2626", "FEE2E2"),
        ("doc.text.fill", "Resultados", "EA580C", "FFEDD5"),
        ("checkmark.shield.fill", "Consentimentos", "0891B2", "CFFAFE"),
        ("person.fill", "Perfil", "64748B", "F1F5F9"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Hero banner
                    heroBanner
                        .padding(.horizontal, 20)
                        .padding(.bottom, 20)

                    // Quick access
                    sectionTitle("Acesso Rápido").padding(.horizontal, 20)
                    quickAccessGrid.padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 20)

                    // Stats bar
                    statsBar.padding(.horizontal, 20).padding(.bottom, 20)

                    // Highlights
                    sectionTitle("Destaques").padding(.horizontal, 20)
                    highlightsRow.padding(.top, 12).padding(.bottom, 20)

                    // Chronic diseases
                    if !(auth.profile?.chronic_conditions ?? []).isEmpty {
                        sectionTitle("Doenças Crónicas").padding(.horizontal, 20)
                        chronicSection.padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 20)
                    } else {
                        emptyChronicCard.padding(.horizontal, 20).padding(.bottom, 20)
                    }

                    // Tabs
                    tabBar.padding(.bottom, 4)
                    tabContent.padding(.horizontal, 20).padding(.bottom, 40)
                }
                .padding(.top, 16)
            }
            .background(Color(hex: "F5F7FA").ignoresSafeArea())
            .navigationTitle("Visão Geral")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await load() }
                    } label: {
                        Image(systemName: "arrow.clockwise").font(.system(size: 14, weight: .semibold))
                    }
                }
            }
            .task { await load() }
        }
    }

    // MARK: Hero
    private var heroBanner: some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 20)
                .fill(LinearGradient(colors: [Color(hex: "1A6B64"), Color(hex: "2D8C82"), Color(hex: "38B2A6")],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "waveform.path.ecg").font(.system(size: 13)).foregroundStyle(.white.opacity(0.8))
                    Text("O seu assistente de saúde digital").font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                }
                Text("Olá, \(firstName) 👋")
                    .font(.system(size: 24, weight: .heavy)).foregroundStyle(.white)
                Text("Avalie sintomas, receba recomendações e marque consultas.")
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.85)).lineSpacing(2)
            }
            .padding(20)
        }
        .frame(height: 120)
    }

    private var firstName: String {
        let name = auth.profile?.full_name ?? auth.profile?.email ?? "Utilizador"
        return String(name.split(separator: " ").first ?? Substring(name))
    }

    // MARK: Quick Access Grid
    private var quickAccessGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 14) {
            ForEach(quickActions, id: \.label) { action in
                VStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color(hex: action.bg))
                        .frame(width: 52, height: 52)
                        .overlay(
                            Image(systemName: action.icon)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(Color(hex: action.color))
                        )
                    Text(action.label)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color(hex: "374151"))
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                }
            }
        }
    }

    // MARK: Stats Bar
    private var statsBar: some View {
        HStack(spacing: 12) {
            statCell(
                icon: "shield.fill",
                color: riskColor(state?.last_triage_risk),
                label: "Último Risco",
                value: riskLabel(state?.last_triage_risk)
            )
            statCell(
                icon: "waveform.path.ecg",
                color: "2D8C82",
                label: "Triagens",
                value: "\(state?.total_triages ?? 0)"
            )
            statCell(
                icon: "calendar.badge.checkmark",
                color: "2563EB",
                label: "Consultas",
                value: "\(state?.total_consultations ?? 0)"
            )
        }
    }

    private func statCell(icon: String, color: String, label: String, value: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color(hex: color))
            Text(value).font(.system(size: 18, weight: .heavy)).foregroundStyle(Color(hex: "101828"))
            Text(label.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(Color(hex: "9CA3AF"))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
    }

    private func riskColor(_ r: String?) -> String {
        switch r?.uppercased() {
        case "URGENT": return "EF4444"
        case "HIGH": return "F97316"
        case "MEDIUM": return "EAB308"
        default: return "22C55E"
        }
    }
    private func riskLabel(_ r: String?) -> String {
        switch r?.uppercased() {
        case "URGENT": return "Urgente"
        case "HIGH": return "Alto"
        case "MEDIUM": return "Médio"
        case "LOW": return "Baixo"
        default: return "—"
        }
    }

    // MARK: Highlights
    private let highlights: [(String, String, String, String)] = [
        ("drop.fill", "0EA5E9", "Mantenha-se hidratado", "Beba pelo menos 2L de água por dia para manter o corpo saudável."),
        ("moon.fill", "6366F1", "Durma bem", "7 a 9 horas de sono por noite são essenciais para a recuperação."),
        ("apple", "22C55E", "Alimentação equilibrada", "Inclua frutas, vegetais e proteínas na sua dieta diária."),
        ("heart.fill", "EF4444", "Check-up regular", "Realize exames preventivos pelo menos uma vez por ano."),
    ]

    private var highlightsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(highlights, id: \.0) { icon, color, title, desc in
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: icon).font(.system(size: 20))
                            .foregroundStyle(Color(hex: color))
                        Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                        Text(desc).font(.system(size: 11)).foregroundStyle(Color(hex: "667085")).lineSpacing(2)
                    }
                    .frame(width: 160, alignment: .leading)
                    .padding(14)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: Chronic
    private var chronicSection: some View {
        VStack(spacing: 10) {
            ForEach(auth.profile?.chronic_conditions ?? [], id: \.self) { cond in
                HStack(spacing: 12) {
                    Image(systemName: "cross.circle.fill").foregroundStyle(Color(hex: "2D8C82"))
                    Text(cond.capitalized).font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: "101828"))
                    Spacer()
                }
                .padding(12).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
            }
        }
    }

    private var emptyChronicCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "heart.text.square").font(.system(size: 32)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Sem condições crónicas registadas")
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
            Text("Adicione as suas condições crónicas no perfil para acompanhamento personalizado.")
                .font(.system(size: 13)).foregroundStyle(Color(hex: "9CA3AF")).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
    }

    // MARK: Tab bar
    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(DashTab.allCases, id: \.self) { t in
                    Button { activeTab = t } label: {
                        VStack(spacing: 0) {
                            Text(t.rawValue)
                                .font(.system(size: 14, weight: activeTab == t ? .bold : .medium))
                                .foregroundStyle(activeTab == t ? Color(hex: "2D8C82") : Color(hex: "667085"))
                                .padding(.horizontal, 20).padding(.vertical, 12)
                            Rectangle().fill(activeTab == t ? Color(hex: "2D8C82") : .clear).frame(height: 2)
                        }
                    }
                }
            }
        }
        .background(Color.white.shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2))
    }

    // MARK: Tab Content
    @ViewBuilder
    private var tabContent: some View {
        switch activeTab {
        case .resumo: resumoTab
        case .triagens: triagensTab
        case .consultas: consultasTab
        case .perfil: perfilTab
        }
    }

    private var resumoTab: some View {
        VStack(spacing: 14) {
            HStack {
                Text("Triagens Recentes").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                Spacer()
                Text("Ver Todas →").font(.system(size: 13, weight: .medium)).foregroundStyle(Color(hex: "2D8C82"))
            }.padding(.top, 16)
            if triages.isEmpty {
                emptyTriageCard
            } else {
                ForEach(triages.prefix(3)) { t in MiniTriageRow(item: t) }
            }
        }
    }

    private var emptyTriageCard: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform.path.ecg").font(.system(size: 28)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Sem triagens recentes").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
        }.frame(maxWidth: .infinity).padding(24).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var triagensTab: some View {
        VStack(spacing: 12) {
            ForEach(triages) { t in MiniTriageRow(item: t) }
            if triages.isEmpty { emptyTriageCard }
        }.padding(.top, 16)
    }

    private var consultasTab: some View {
        VStack(spacing: 12) {
            ForEach(consultations) { c in ConsultaCard(item: c) }
            if consultations.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar").font(.system(size: 28)).foregroundStyle(Color(hex: "D1D5DB"))
                    Text("Sem consultas").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
                }.frame(maxWidth: .infinity).padding(24).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }.padding(.top, 16)
    }

    private var perfilTab: some View {
        VStack(spacing: 14) {
            profileInfoRow(label: "Email", value: auth.profile?.email ?? "—")
            profileInfoRow(label: "Nome", value: auth.profile?.full_name ?? "—")
            profileInfoRow(label: "Tipo Sanguíneo", value: auth.profile?.blood_type ?? "—")
            profileInfoRow(label: "Alergias", value: auth.profile?.allergies?.joined(separator: ", ") ?? "Nenhuma")
        }.padding(.top, 16)
    }

    private func profileInfoRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(.system(size: 13)).foregroundStyle(Color(hex: "667085")).frame(width: 120, alignment: .leading)
            Text(value).font(.system(size: 13, weight: .medium)).foregroundStyle(Color(hex: "101828"))
            Spacer()
        }
        .padding(12).background(.white).clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(Color(hex: "101828"))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Load
    private func load() async {
        guard let t = auth.token else { isLoading = false; return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/dashboard/patient-state", token: t)),
                   let s = try? JSONDecoder().decode(PatientState.self, from: data) {
                    await MainActor.run { self.state = s }
                }
            }
            group.addTask {
                if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/triage/history", token: t)),
                   let list = try? JSONDecoder().decode([TriageHistoryItem].self, from: data) {
                    await MainActor.run { self.triages = Array(list.prefix(5)) }
                }
            }
            group.addTask {
                if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/consultations/me", token: t)),
                   let list = try? JSONDecoder().decode([ConsultationItem].self, from: data) {
                    await MainActor.run { self.consultations = Array(list.prefix(5)) }
                }
            }
        }
        await auth.loadProfile()
        isLoading = false
    }
}

// MARK: - Mini Triage Row
struct MiniTriageRow: View {
    let item: TriageHistoryItem
    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(Color(hex: item.riskColor).opacity(0.12)).frame(width: 40, height: 40)
                .overlay(Image(systemName: "waveform.path.ecg").font(.system(size: 16)).foregroundStyle(Color(hex: item.riskColor)))
            VStack(alignment: .leading, spacing: 2) {
                Text(item.displayRisk).font(.system(size: 13, weight: .bold)).foregroundStyle(Color(hex: item.riskColor))
                Text(item.complaint ?? item.category ?? "—").font(.system(size: 12)).foregroundStyle(Color(hex: "667085")).lineLimit(1)
                if let at = item.created_at { Text(shortDate(at)).font(.system(size: 11)).foregroundStyle(Color(hex: "9CA3AF")) }
            }
            Spacer()
        }
        .padding(12).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }
    private func shortDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) {
            let df = DateFormatter(); df.dateStyle = .short; df.locale = Locale(identifier: "pt_PT"); return df.string(from: d)
        }
        return iso
    }
}
