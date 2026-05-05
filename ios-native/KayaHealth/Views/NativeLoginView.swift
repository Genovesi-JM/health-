import SwiftUI

// MARK: - Native Login Screen
struct NativeLoginView: View {
    @StateObject private var auth = AuthService.shared
    @State private var email = ""
    @State private var password = ""
    @State private var error = ""
    @State private var isLoading = false

    var body: some View {
        ZStack {
            Color(hex: "F5F7FA").ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 28) {
                    // Logo + header
                    VStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 20)
                            .fill(LinearGradient(
                                colors: [Color(hex: "1A6B64"), Color(hex: "2D8C82"), Color(hex: "38B2A6")],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ))
                            .frame(width: 72, height: 72)
                            .overlay(
                                Image(systemName: "heart.text.square.fill")
                                    .font(.system(size: 34, weight: .semibold))
                                    .foregroundStyle(.white)
                            )
                            .shadow(color: Color(hex: "2D8C82").opacity(0.3), radius: 16, x: 0, y: 8)

                        VStack(spacing: 6) {
                            Text("HEALTH").font(.system(size: 28, weight: .heavy)).foregroundStyle(Color(hex: "101828"))
                            Text("Triage & Teleconsulta").font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: "2D8C82"))
                        }
                    }
                    .padding(.top, 50)

                    // Form card
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Entrar na sua conta")
                            .font(.system(size: 20, weight: .bold)).foregroundStyle(Color(hex: "101828"))

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
                            TextField("email@exemplo.com", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(14)
                                .background(Color(hex: "F9FAFB"))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Palavra-passe").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
                            SecureField("••••••••", text: $password)
                                .padding(14)
                                .background(Color(hex: "F9FAFB"))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                        }

                        if !error.isEmpty {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.circle.fill").foregroundStyle(.red)
                                Text(error).font(.system(size: 13)).foregroundStyle(.red)
                            }
                        }

                        Button {
                            Task { await doLogin() }
                        } label: {
                            HStack {
                                Spacer()
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    Image(systemName: "arrow.right.circle.fill").foregroundStyle(.white)
                                    Text("Entrar").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                                }
                                Spacer()
                            }
                            .frame(height: 52)
                            .background(Color(hex: "2D8C82"))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(isLoading || email.isEmpty || password.isEmpty)
                        .opacity((email.isEmpty || password.isEmpty) ? 0.6 : 1)
                    }
                    .padding(24)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .shadow(color: Color.black.opacity(0.06), radius: 20, x: 0, y: 10)
                    .padding(.horizontal, 24)

                    // Divider + register link
                    VStack(spacing: 12) {
                        HStack {
                            Rectangle().fill(Color(hex: "E5E7EB")).frame(height: 1)
                            Text("ou").font(.system(size: 12)).foregroundStyle(Color(hex: "9CA3AF")).padding(.horizontal, 8)
                            Rectangle().fill(Color(hex: "E5E7EB")).frame(height: 1)
                        }.padding(.horizontal, 24)

                        Text("Não tem conta? Registe-se no portal web em health.geovisionops.com")
                            .font(.system(size: 13)).foregroundStyle(Color(hex: "667085"))
                            .multilineTextAlignment(.center).padding(.horizontal, 32)
                    }

                    Spacer(minLength: 40)
                }
            }
        }
        .onSubmit { Task { await doLogin() } }
    }

    private func doLogin() async {
        guard !email.isEmpty, !password.isEmpty else { return }
        isLoading = true; error = ""
        do {
            try await auth.login(email: email, password: password)
        } catch {
            self.error = (error as? AuthService.AuthError)?.errorDescription ?? "Erro ao iniciar sessão."
        }
        isLoading = false
    }
}
