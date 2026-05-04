import SwiftUI
import WebKit

// MARK: - Main App
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
    // Change these URLs if your deployed routes are different.
    static let homeURL         = URL(string: "https://genovesi-jm.github.io/health-/")!
    static let loginURL        = URL(string: "https://genovesi-jm.github.io/health-/login")!
    static let registerURL     = URL(string: "https://genovesi-jm.github.io/health-/register")!
    static let patientProfileURL = URL(string: "https://genovesi-jm.github.io/health-/patient/profile")!
    static let dashboardURL    = URL(string: "https://genovesi-jm.github.io/health-/dashboard")!
    static let servicesURL     = URL(string: "https://genovesi-jm.github.io/health-/services")!
    static let specialistsURL  = URL(string: "https://genovesi-jm.github.io/health-/medicos")!
    static let prescriptionRequestURL = URL(string: "https://genovesi-jm.github.io/health-/prescricoes/pedido")!
}

// MARK: - Root
struct KayaRootView: View {
    var body: some View {
        NavigationStack {
            KayaHomeView()
        }
    }
}
