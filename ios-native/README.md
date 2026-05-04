# 📱 KayaHealth — iOS Native (Swift / SwiftUI)

App nativa iOS que envolve o portal web KAYA via WebView, com ecrãs nativos SwiftUI para a landing, login helper e prévia do perfil do paciente.

---

## Estrutura

```
ios-native/KayaHealth/
├── KayaHealthApp.swift          ← Entry point (@main) + KayaConfig (URLs)
│
├── Views/
│   ├── HomeView.swift           ← Landing: hero, quick actions, serviços, CTA
│   ├── LoginView.swift          ← Helper nativo de login + acesso ao portal real
│   └── PatientPreviewView.swift ← Prévia do perfil do paciente (dados demo)
│
├── Components/
│   └── Components.swift         ← QuickActionCard, ServiceRow, StepRow
│
├── WebView/
│   └── WebViewScreen.swift      ← WebDestination model + WKWebView wrapper
│
└── Extensions/
    └── Color+Hex.swift          ← Color(hex: "2D8C82")
```

---

## Como abrir no Xcode

### Opção A — Criar projeto novo e adicionar os ficheiros

1. Abre Xcode → **File → New → Project**
2. Escolhe **App** (iOS) → SwiftUI + Swift
3. Nome: `KayaHealth` · Bundle ID: `com.kayahealth.app`
4. Arrasta os ficheiros desta pasta para o project navigator do Xcode
5. Prima **▶** para correr no simulador

### Opção B — Swift Package (sem .xcodeproj)

```bash
cd ios-native
swift package init --type executable   # só para ver a estrutura
```

---

## Configurar URLs

Edita `KayaHealthApp.swift` → `enum KayaConfig`:

```swift
static let homeURL  = URL(string: "https://genovesi-jm.github.io/health-/")!
static let loginURL = URL(string: "https://genovesi-jm.github.io/health-/login")!
// ... etc
```

---

## Requisitos

| | |
|---|---|
| iOS | 17+ |
| Xcode | 15+ |
| Swift | 5.9+ |
| Dependências | Nenhuma (só SwiftUI + WebKit) |

---

## Fluxo da app

```
KayaRootView
  └── NavigationStack
        └── KayaHomeView          ← Landing nativa
              ├── NavigationLink → KayaLoginView
              │     └── sheet   → KayaWebViewScreen (portal web real)
              ├── NavigationLink → PatientDashboardPreviewView
              └── sheet          → KayaMenuView (burger)
```
