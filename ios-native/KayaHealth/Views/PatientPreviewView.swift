import SwiftUI

// MARK: - Patient Dashboard Preview
struct PatientDashboardPreviewView: View {
    @State private var webDestination: WebDestination?

    var body: some View {
        ZStack {
            Color(hex: "F7FAFC").ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    patientHeader
                    kpiGrid
                    chronicCare
                    medicationCard
                    vitalsCard
                    historyCard
                    portalButtons
                }
                .padding(20)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle("Perfil do Paciente")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $webDestination) { destination in
            KayaWebViewScreen(destination: destination)
        }
    }

    private var patientHeader: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(Color(hex: "2D8C82"))
                .frame(width: 58, height: 58)
                .overlay(
                    Text("PA")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text("Paciente Demo")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(Color(hex: "101828"))
                Text("Perfil de saúde organizado")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color(hex: "5D6B82"))

                HStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill")
                    Text("Conta paciente")
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: "2D8C82"))
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .background(Color(hex: "EAF7F4"))
                .clipShape(Capsule())
            }

            Spacer()
        }
        .padding(18)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: Color.black.opacity(0.05), radius: 14, x: 0, y: 8)
    }

    private var kpiGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            PatientMetricCard(title: "Consultas", value: "2",   icon: "calendar",     color: "3B82F6")
            PatientMetricCard(title: "Receitas",  value: "1",   icon: "pills.fill",   color: "8B5CF6")
            PatientMetricCard(title: "Alertas",   value: "0",   icon: "bell.fill",    color: "F59E0B")
            PatientMetricCard(title: "Perfil",    value: "80%", icon: "person.fill",  color: "2D8C82")
        }
    }

    private var chronicCare: some View {
        PreviewSectionCard(
            icon: "heart.text.square.fill",
            title: "Cuidado crónico",
            subtitle: "Condições registadas",
            rows: [
                ("Hipertensão",  "Acompanhamento mensal recomendado"),
                ("Alergias",     "Sem alergias registadas"),
                ("Follow-up",    "Próximo controlo em 30 dias")
            ]
        )
    }

    private var medicationCard: some View {
        PreviewSectionCard(
            icon: "pills.fill",
            title: "Medicação",
            subtitle: "Gestão e renovação",
            rows: [
                ("Amlodipina 5mg", "1x por dia — ativo"),
                ("Renovação",      "Pedido pendente de revisão médica"),
                ("Adesão",         "Lembretes ativados")
            ]
        )
    }

    private var vitalsCard: some View {
        PreviewSectionCard(
            icon: "waveform.path.ecg",
            title: "Sinais vitais",
            subtitle: "Últimos dados",
            rows: [
                ("Tensão arterial", "128/82 mmHg"),
                ("Oxigénio",        "98%"),
                ("Temperatura",     "36.7 ºC")
            ]
        )
    }

    private var historyCard: some View {
        PreviewSectionCard(
            icon: "clock.arrow.circlepath",
            title: "Histórico clínico",
            subtitle: "Resumo rápido",
            rows: [
                ("Última consulta", "Clínica geral — há 12 dias"),
                ("Última receita",  "Aprovada — há 28 dias"),
                ("Documentos",      "2 exames guardados")
            ]
        )
    }

    private var portalButtons: some View {
        VStack(spacing: 10) {
            Button { webDestination = WebDestination(kind: .patientProfile) } label: {
                Label("Abrir perfil real no portal", systemImage: "safari.fill")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Color(hex: "2D8C82"))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            Button { webDestination = WebDestination(kind: .prescriptions) } label: {
                Label("Pedir renovação de receita", systemImage: "pills.fill")
                    .font(.system(size: 16, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(.white)
                    .foregroundStyle(Color(hex: "2D8C82"))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "C8E9E4"), lineWidth: 1))
            }
        }
    }
}

// MARK: - Patient Metric Card
struct PatientMetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(hex: color))
                .frame(width: 38, height: 38)
                .background(Color(hex: color).opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 13))

            Text(value)
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Color(hex: "101828"))

            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color(hex: "667085"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.045), radius: 12, x: 0, y: 8)
    }
}

// MARK: - Preview Section Card
struct PreviewSectionCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let rows: [(String, String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color(hex: "2D8C82"))
                    .frame(width: 42, height: 42)
                    .background(Color(hex: "EAF7F4"))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 18, weight: .heavy))
                        .foregroundStyle(Color(hex: "101828"))
                    Text(subtitle)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "667085"))
                }
                Spacer()
            }

            VStack(spacing: 10) {
                ForEach(rows, id: \.0) { row in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.0)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color(hex: "101828"))
                            Text(row.1)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(hex: "667085"))
                        }
                        Spacer()
                    }
                    .padding(.vertical, 4)

                    if row.0 != rows.last?.0 {
                        Divider()
                    }
                }
            }
        }
        .padding(18)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.black.opacity(0.045), radius: 12, x: 0, y: 8)
    }
}
