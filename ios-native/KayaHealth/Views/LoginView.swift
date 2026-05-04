import SwiftUI

// MARK: - Native Login Helper
struct KayaLoginView: View {
    @State private var email = "paciente@health.com"
    @State private var password = ""
    @State private var webDestination: WebDestination?

    var body: some View {
        ZStack {
            Color(hex: "F7FAFC").ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 40, weight: .bold))
                            .foregroundStyle(Color(hex: "2D8C82"))
                            .padding(.bottom, 4)

                        Text("Entrar na KAYA")
                            .font(.system(size: 28, weight: .heavy))
                            .foregroundStyle(Color(hex: "101828"))

                        Text("Usa o portal real para autenticação ou vê uma prévia do perfil do paciente.")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color(hex: "5D6B82"))
                            .multilineTextAlignment(.center)
                            .lineSpacing(2)
                    }
                    .padding(.top, 24)

                    // Form
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Email")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color(hex: "475467"))
                        TextField("email", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(15)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color(hex: "D0D5DD"), lineWidth: 1))

                        Text("Palavra-passe")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color(hex: "475467"))
                        SecureField("password", text: $password)
                            .padding(15)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 15))
                            .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color(hex: "D0D5DD"), lineWidth: 1))

                        Text("Nota: este ecrã é um helper nativo para testes. O login seguro real continua no portal web, porque o token e a sessão ainda são geridos pelo teu React/backend.")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: "667085"))
                            .lineSpacing(2)
                            .padding(.top, 2)
                    }
                    .padding(18)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .shadow(color: Color.black.opacity(0.05), radius: 14, x: 0, y: 8)

                    // Actions
                    VStack(spacing: 10) {
                        Button { webDestination = WebDestination(kind: .portal) } label: {
                            Label("Abrir login real do portal", systemImage: "safari.fill")
                                .font(.system(size: 16, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 15)
                                .background(Color(hex: "2D8C82"))
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                        }

                        Button { webDestination = WebDestination(kind: .register) } label: {
                            Label("Criar conta real", systemImage: "person.badge.plus")
                                .font(.system(size: 16, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 15)
                                .background(.white)
                                .foregroundStyle(Color(hex: "2D8C82"))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "C8E9E4"), lineWidth: 1))
                        }

                        NavigationLink { PatientDashboardPreviewView() } label: {
                            Label("Ver prévia do perfil do paciente", systemImage: "person.text.rectangle.fill")
                                .font(.system(size: 16, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 15)
                                .background(Color(hex: "EAF7F4"))
                                .foregroundStyle(Color(hex: "214E49"))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                        }
                    }

                    // Tips
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Para testar login real:")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color(hex: "101828"))
                        Text("1. Clica em "Criar conta real" e cria um paciente novo.\n2. Depois entra com essa conta.\n3. Para ver o perfil real, abre "Perfil" no portal.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: "5D6B82"))
                            .lineSpacing(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(hex: "FFF7E6"))
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                }
                .padding(20)
            }
        }
        .navigationTitle("Portal KAYA")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $webDestination) { destination in
            KayaWebViewScreen(destination: destination)
        }
    }
}
