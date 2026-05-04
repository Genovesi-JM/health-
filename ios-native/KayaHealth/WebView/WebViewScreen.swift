import SwiftUI
import WebKit

// MARK: - Web Destination Model
struct WebDestination: Identifiable {
    enum Kind {
        case portal
        case register
        case services
        case specialists
        case prescriptions
        case patientProfile
        case dashboard

        var title: String {
            switch self {
            case .portal:          return "Portal KAYA"
            case .register:        return "Criar conta"
            case .services:        return "Serviços"
            case .specialists:     return "Especialistas"
            case .prescriptions:   return "Receitas"
            case .patientProfile:  return "Perfil"
            case .dashboard:       return "Dashboard"
            }
        }

        var url: URL {
            switch self {
            case .portal:          return KayaConfig.loginURL
            case .register:        return KayaConfig.registerURL
            case .services:        return KayaConfig.servicesURL
            case .specialists:     return KayaConfig.specialistsURL
            case .prescriptions:   return KayaConfig.prescriptionRequestURL
            case .patientProfile:  return KayaConfig.patientProfileURL
            case .dashboard:       return KayaConfig.dashboardURL
            }
        }
    }

    let id = UUID()
    let kind: Kind
}

// MARK: - WebView Screen (sheet wrapper)
struct KayaWebViewScreen: View {
    @Environment(\.dismiss) private var dismiss
    let destination: WebDestination

    var body: some View {
        NavigationStack {
            WebView(url: destination.kind.url)
                .navigationTitle(destination.kind.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Fechar") { dismiss() }
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color(hex: "2D8C82"))
                    }
                }
        }
    }
}

// MARK: - WKWebView wrapper
struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
