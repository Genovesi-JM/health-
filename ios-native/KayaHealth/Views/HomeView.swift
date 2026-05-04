import SwiftUI

// MARK: - Home View
struct KayaHomeView: View {
    @State private var showMenu = false
    @State private var webDestination: WebDestination?

    var body: some View {
        ZStack {
            Color(hex: "F7FAFC")
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 22) {
                    header
                    hero
                    quickActions
                    services
                    howItWorks
                    finalCTA
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .sheet(item: $webDestination) { destination in
            KayaWebViewScreen(destination: destination)
        }
        .sheet(isPresented: $showMenu) {
            KayaMenuView(
                openPortal:       { open(.portal)       },
                openRegister:     { open(.register)     },
                openServices:     { open(.services)     },
                openSpecialists:  { open(.specialists)  },
                openPrescriptions:{ open(.prescriptions)},
                openPatientProfile:{ open(.patientProfile) }
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: Header
    private var header: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 12)
                .fill(LinearGradient(
                    colors: [Color(hex: "2D8C82"), Color(hex: "55B7A8")],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                .frame(width: 42, height: 42)
                .overlay(
                    Image(systemName: "heart.text.square.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 1) {
                Text("KAYA")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color(hex: "101828"))
                Text("Saúde na sua mão")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: "2D8C82"))
            }

            Spacer()

            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 13, weight: .semibold))
                Text("🇵🇹 PT")
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(Color(hex: "214E49"))
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(hex: "EAF7F4"))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Button { showMenu = true } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color(hex: "101828"))
                    .frame(width: 36, height: 36)
            }
            .accessibilityLabel("Abrir menu")
        }
        .padding(.top, 12)
    }

    // MARK: Hero
    private var hero: some View {
        VStack(spacing: 16) {
            Text("A tua saúde,\nmais simples.")
                .font(.system(size: 34, weight: .heavy))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color(hex: "101828"))
                .lineSpacing(-2)
                .padding(.top, 16)

            Text("Marca consultas, pede receitas e acompanha a tua saúde num só portal.")
                .font(.system(size: 17, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color(hex: "5D6B82"))
                .lineSpacing(3)
                .padding(.horizontal, 4)

            VStack(spacing: 10) {
                NavigationLink {
                    KayaLoginView()
                } label: {
                    Label("Entrar no Portal", systemImage: "arrow.right.circle.fill")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(Color(hex: "2D8C82"))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(color: Color.black.opacity(0.12), radius: 12, x: 0, y: 8)
                }

                Button { open(.register) } label: {
                    Label("Criar conta grátis", systemImage: "person.badge.plus")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(.white)
                        .foregroundStyle(Color(hex: "2D8C82"))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "C8E9E4"), lineWidth: 1.2))
                }

                Button { open(.services) } label: {
                    Text("Conhecer serviços")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: "2D8C82"))
                        .padding(.top, 2)
                }
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 18)
    }

    // MARK: Quick Actions
    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Acesso rápido")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(hex: "101828"))

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                QuickActionCard(title: "Consulta",    icon: "calendar.badge.plus",          color: "2D8C82") { open(.services)      }
                QuickActionCard(title: "Teleconsulta",icon: "video.fill",                   color: "3B82F6") { open(.services)      }
                QuickActionCard(title: "Receitas",    icon: "pills.fill",                   color: "8B5CF6") { open(.prescriptions) }
                QuickActionCard(title: "Perfil",      icon: "person.text.rectangle.fill",   color: "EF7C8E") { open(.patientProfile)}
            }
        }
    }

    // MARK: Services
    private var services: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("O que podes fazer na KAYA")
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Color(hex: "101828"))

            VStack(spacing: 12) {
                ServiceRow(icon: "calendar",          title: "Marcar consulta",             description: "Escolhe especialidade, médico e horário.")
                ServiceRow(icon: "video",             title: "Fazer teleconsulta",           description: "Fala com um médico sem sair de casa.")
                ServiceRow(icon: "pills",             title: "Pedir renovação de receita",   description: "Envia o pedido e o médico revê o teu histórico.")
                ServiceRow(icon: "heart.text.square", title: "Acompanhar saúde crónica",     description: "Organiza medicação, sinais vitais e follow-ups.")
            }
        }
        .padding(.top, 4)
    }

    // MARK: How It Works
    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Como funciona")
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Color(hex: "101828"))

            VStack(spacing: 10) {
                StepRow(number: "1", title: "Cria a tua conta")
                StepRow(number: "2", title: "Escolhe o serviço")
                StepRow(number: "3", title: "Acompanha tudo no portal")
            }
            .padding(16)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: Color.black.opacity(0.05), radius: 14, x: 0, y: 8)
        }
    }

    // MARK: Final CTA
    private var finalCTA: some View {
        VStack(spacing: 12) {
            Text("Pronto para começar?")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color(hex: "101828"))

            Text("Entra no portal ou vê uma prévia do perfil do paciente.")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color(hex: "5D6B82"))
                .multilineTextAlignment(.center)

            HStack(spacing: 10) {
                NavigationLink { KayaLoginView() } label: {
                    Text("Entrar")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color(hex: "2D8C82"))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 15))
                }

                NavigationLink { PatientDashboardPreviewView() } label: {
                    Text("Prévia paciente")
                        .font(.system(size: 15, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(.white)
                        .foregroundStyle(Color(hex: "2D8C82"))
                        .clipShape(RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color(hex: "C8E9E4"), lineWidth: 1))
                }
            }
        }
        .padding(20)
        .background(Color(hex: "EAF7F4"))
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .padding(.top, 4)
    }

    // MARK: Helper
    private func open(_ destination: WebDestination.Kind) {
        showMenu = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            webDestination = WebDestination(kind: destination)
        }
    }
}
