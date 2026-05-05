import SwiftUI

// MARK: - Patient App Shell (after login)
struct PatientAppView: View {
    @StateObject private var auth = AuthService.shared
    @State private var tab: Tab = .dashboard

    enum Tab { case dashboard, triagem, consultas, familia, mais }

    var body: some View {
        TabView(selection: $tab) {
            DashboardView()
                .tabItem { Label("Início", systemImage: "house.fill") }
                .tag(Tab.dashboard)

            PatientTriagemView()
                .tabItem { Label("Triagem", systemImage: "waveform.path.ecg") }
                .tag(Tab.triagem)

            PatientConsultasView()
                .tabItem { Label("Consultas", systemImage: "calendar") }
                .tag(Tab.consultas)

            PatientFamiliaView()
                .tabItem { Label("Família", systemImage: "person.2.fill") }
                .tag(Tab.familia)

            PatientMaisView()
                .tabItem { Label("Mais", systemImage: "ellipsis") }
                .tag(Tab.mais)
        }
        .tint(Color(hex: "2D8C82"))
    }
}

// MARK: - Consultas View (placeholder scaffold)
struct PatientConsultasView: View {
    @StateObject private var auth = AuthService.shared
    @State private var items: [ConsultationItem] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if isLoading {
                        ProgressView().padding(.top, 60)
                    } else if items.isEmpty {
                        emptyState
                    } else {
                        VStack(spacing: 12) {
                            ForEach(items) { c in ConsultaCard(item: c) }
                        }.padding(.horizontal, 20)
                    }
                }
                .padding(.vertical, 20)
            }
            .background(Color(hex: "F5F7FA").ignoresSafeArea())
            .navigationTitle("Consultas")
            .navigationBarTitleDisplayMode(.large)
            .task { await load() }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 44)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Sem consultas marcadas")
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
            Text("As tuas consultas aparecerão aqui.")
                .font(.system(size: 14)).foregroundStyle(Color(hex: "9CA3AF"))
        }.padding(.top, 60)
    }

    private func load() async {
        guard let t = auth.token else { isLoading = false; return }
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/consultations/me", token: t)),
           let list = try? JSONDecoder().decode([ConsultationItem].self, from: data) {
            items = list
        }
        isLoading = false
    }
}

struct ConsultaCard: View {
    let item: ConsultationItem
    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 12).fill(Color(hex: "2D8C82").opacity(0.1))
                .frame(width: 48, height: 48)
                .overlay(Image(systemName: "stethoscope").font(.system(size: 20)).foregroundStyle(Color(hex: "2D8C82")))
            VStack(alignment: .leading, spacing: 4) {
                Text(item.specialty?.capitalized ?? "Consulta").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                if let doc = item.doctor_name { Text(doc).font(.system(size: 13)).foregroundStyle(Color(hex: "667085")) }
                if let at = item.scheduled_at { Text(formatDate(at)).font(.system(size: 12)).foregroundStyle(Color(hex: "9CA3AF")) }
            }
            Spacer()
            Text(item.statusLabel).font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color(hex: item.statusColor))
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Color(hex: item.statusColor).opacity(0.1)).clipShape(Capsule())
        }
        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
    }
    private func formatDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) {
            let df = DateFormatter(); df.dateStyle = .medium; df.timeStyle = .short; df.locale = Locale(identifier: "pt_PT")
            return df.string(from: d)
        }
        return iso
    }
}

// MARK: - "Mais" tab — links to profile, settings, alerts, readings, etc.
struct PatientMaisView: View {
    @StateObject private var auth = AuthService.shared
    @State private var path = NavigationPath()

    enum MaisRoute: Hashable { case profile, alertas, medicoes, definicoes, consentimentos, autocuidado }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 0) {
                    // User card
                    userCard
                        .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 8)

                    sectionHeader("Saúde & Medições")
                    maisRow(icon: "heart.text.square.fill", color: "EF4444", label: "Minhas Medições") { path.append(MaisRoute.medicoes) }
                    maisRow(icon: "bell.fill", color: "F59E0B", label: "Alertas & Notificações") { path.append(MaisRoute.alertas) }
                    maisRow(icon: "cross.case.fill", color: "3B82F6", label: "Autocuidado") { path.append(MaisRoute.autocuidado) }
                    maisRow(icon: "doc.text.fill", color: "8B5CF6", label: "Consentimentos") { path.append(MaisRoute.consentimentos) }

                    sectionHeader("Conta")
                    maisRow(icon: "person.fill", color: "2D8C82", label: "Meu Perfil") { path.append(MaisRoute.profile) }
                    maisRow(icon: "gearshape.fill", color: "6B7280", label: "Definições") { path.append(MaisRoute.definicoes) }

                    Button {
                        auth.logout()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.right.square.fill").foregroundStyle(.red)
                            Text("Terminar Sessão").foregroundStyle(.red).font(.system(size: 15, weight: .semibold))
                            Spacer()
                        }
                        .padding(16).background(.white)
                    }
                    .padding(.top, 8)

                    Spacer(minLength: 40)
                }
            }
            .background(Color(hex: "F5F7FA").ignoresSafeArea())
            .navigationTitle("Mais")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: MaisRoute.self) { route in
                switch route {
                case .profile: PatientProfileView()
                case .alertas: PatientAlertasView()
                case .medicoes: PatientMedicoesView()
                case .definicoes: PatientDefinicoesView()
                case .consentimentos: PatientConsentimentosView()
                case .autocuidado: PatientAutocuidadoView()
                }
            }
        }
    }

    private var userCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Color(hex: "2D8C82"))
                Text(initials).font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
            }.frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(auth.profile?.full_name ?? auth.profile?.email ?? "Paciente")
                    .font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                Text("Paciente").font(.system(size: 13)).foregroundStyle(Color(hex: "667085"))
            }
            Spacer()
        }
        .padding(16).background(.white).clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
    }

    private var initials: String {
        let name = auth.profile?.full_name ?? auth.profile?.email ?? "U"
        let parts = name.split(separator: " ")
        if parts.count >= 2 { return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased() }
        return String(name.prefix(2)).uppercased()
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .bold)).foregroundStyle(Color(hex: "9CA3AF"))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 4)
    }

    private func maisRow(icon: String, color: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 10).fill(Color(hex: color).opacity(0.12))
                    .frame(width: 40, height: 40)
                    .overlay(Image(systemName: icon).font(.system(size: 16)).foregroundStyle(Color(hex: color)))
                Text(label).font(.system(size: 15, weight: .medium)).foregroundStyle(Color(hex: "101828"))
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "D1D5DB"))
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .background(.white)
        }
        Divider().padding(.leading, 74)
    }
}

// MARK: - Placeholder stubs (replaced by actual views below)
struct PatientDefinicoesView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "gearshape.fill").font(.system(size: 44)).foregroundStyle(Color(hex: "2D8C82"))
                Text("Definições").font(.system(size: 20, weight: .bold))
                Text("Em breve").foregroundStyle(Color(hex: "9CA3AF"))
            }.padding(.top, 60)
        }
        .navigationTitle("Definições")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
    }
}

struct PatientConsentimentosView: View {
    var body: some View {
        VStack {
            Image(systemName: "doc.text.fill").font(.system(size: 44)).foregroundStyle(Color(hex: "2D8C82")).padding(.top, 60)
            Text("Consentimentos").font(.system(size: 20, weight: .bold)).padding(.top, 8)
            Text("Em breve").foregroundStyle(Color(hex: "9CA3AF"))
            Spacer()
        }
        .navigationTitle("Consentimentos")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
    }
}

struct PatientAutocuidadoView: View {
    private let tips: [(String, String, String)] = [
        ("drop.fill", "2D8C82", "Mantanha-se hidratado\nBeba pelo menos 2L de água por dia."),
        ("moon.fill", "6366F1", "Durma bem\n7 a 9 horas de sono por noite são essenciais."),
        ("fork.knife", "22C55E", "Alimentação equilibrada\nInclua frutas, vegetais e proteínas na sua dieta diária."),
        ("heart.fill", "EF4444", "Check-up regular\nRealize exames preventivos pelo menos uma vez por ano."),
    ]
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ForEach(tips, id: \.0) { icon, color, text in
                    HStack(alignment: .top, spacing: 14) {
                        RoundedRectangle(cornerRadius: 10).fill(Color(hex: color).opacity(0.1)).frame(width: 42, height: 42)
                            .overlay(Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color(hex: color)))
                        VStack(alignment: .leading, spacing: 4) {
                            let parts = text.split(separator: "\n", maxSplits: 1)
                            Text(String(parts.first ?? "")).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                            if parts.count > 1 { Text(String(parts[1])).font(.system(size: 13)).foregroundStyle(Color(hex: "667085")) }
                        }
                        Spacer()
                    }
                    .padding(16).background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                }
            }.padding(20)
        }
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
        .navigationTitle("Autocuidado")
        .navigationBarTitleDisplayMode(.inline)
    }
}
