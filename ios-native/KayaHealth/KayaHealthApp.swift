import SwiftUI

// MARK: - Entry Point
@main
struct KayaHealthApp: App {
    var body: some Scene {
        WindowGroup {
            KayaRootView()
        }
    }
}

// MARK: - Config
enum KayaConfig {
    static let homeURL               = URL(string: "https://genovesi-jm.github.io/health-/")!
    static let loginURL              = URL(string: "https://genovesi-jm.github.io/health-/login")!
    static let registerURL           = URL(string: "https://genovesi-jm.github.io/health-/register")!
    static let patientProfileURL     = URL(string: "https://genovesi-jm.github.io/health-/patient/profile")!
    static let dashboardURL          = URL(string: "https://genovesi-jm.github.io/health-/dashboard")!
    static let servicesURL           = URL(string: "https://genovesi-jm.github.io/health-/services")!
    static let specialistsURL        = URL(string: "https://genovesi-jm.github.io/health-/medicos")!
    static let prescriptionRequestURL = URL(string: "https://genovesi-jm.github.io/health-/prescricoes/pedido")!
}

// MARK: - Root View (auth-aware)
struct KayaRootView: View {
    @StateObject private var auth = AuthService.shared

    var body: some View {
        Group {
            if auth.token != nil {
                PatientAppView()
            } else {
                NativeLoginView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: auth.token)
    }
}

