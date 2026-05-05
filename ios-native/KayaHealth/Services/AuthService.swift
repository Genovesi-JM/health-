import SwiftUI
import Combine

// MARK: - API Base
enum API {
    static let base = "https://health.geovisionops.com"

    static func request(_ path: String, method: String = "GET", token: String? = nil, body: [String: Any]? = nil) -> URLRequest {
        var req = URLRequest(url: URL(string: "\(base)\(path)")!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let t = token { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        if let b = body { req.httpBody = try? JSONSerialization.data(withJSONObject: b) }
        return req
    }
}

// MARK: - Auth Service
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var token: String? = UserDefaults.standard.string(forKey: "auth_token")
    @Published var profile: PatientProfile?
    @Published var isLoading = false

    private init() {
        if token != nil { Task { await loadProfile() } }
    }

    func login(email: String, password: String) async throws {
        isLoading = true
        defer { isLoading = false }
        let req = API.request("/api/v1/auth/login", method: "POST", body: [
            "username": email, "password": password
        ])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw AuthError.invalidCredentials
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        token = decoded.access_token
        UserDefaults.standard.set(decoded.access_token, forKey: "auth_token")
        await loadProfile()
    }

    func logout() {
        token = nil
        profile = nil
        UserDefaults.standard.removeObject(forKey: "auth_token")
    }

    func loadProfile() async {
        guard let t = token else { return }
        guard let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/patients/me", token: t)),
              let p = try? JSONDecoder().decode(PatientProfile.self, from: data) else { return }
        profile = p
    }

    enum AuthError: Error, LocalizedError {
        case invalidCredentials
        var errorDescription: String? { "Email ou palavra-passe incorretos." }
    }
}

// MARK: - Token Response
struct TokenResponse: Decodable {
    let access_token: String
    let token_type: String
}
