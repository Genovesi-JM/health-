import SwiftUI

// MARK: - Menu
struct KayaMenuView: View {
    @Environment(\.dismiss) private var dismiss

    let openPortal:        () -> Void
    let openRegister:      () -> Void
    let openServices:      () -> Void
    let openSpecialists:   () -> Void
    let openPrescriptions: () -> Void
    let openPatientProfile:() -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("KAYA")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Color(hex: "101828"))
                    Text("Menu do paciente")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color(hex: "2D8C82"))
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Color(hex: "101828"))
                        .frame(width: 40, height: 40)
                        .background(Color(hex: "F2F4F7"))
                        .clipShape(Circle())
                }
            }
            .padding(20)

            // Menu items — keep this short, it's an app not a website
            VStack(spacing: 8) {
                MenuRow(icon: "house.fill",                  title: "Início")               { dismiss()             }
                MenuRow(icon: "heart.text.square.fill",      title: "Serviços")             { openServices()        }
                MenuRow(icon: "person.text.rectangle.fill",  title: "Perfil do paciente")   { openPatientProfile()  }
                MenuRow(icon: "stethoscope",                 title: "Especialistas")         { openSpecialists()     }
                MenuRow(icon: "pills.fill",                  title: "Receitas")              { openPrescriptions()   }
                MenuRow(icon: "questionmark.circle.fill",    title: "Ajuda / FAQ")          { openServices()        }
            }
            .padding(.horizontal, 20)

            Spacer()

            // CTAs
            VStack(spacing: 10) {
                Button(action: openPortal) {
                    Text("Entrar no Portal")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(Color(hex: "2D8C82"))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }

                Button(action: openRegister) {
                    Text("Criar conta grátis")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(.white)
                        .foregroundStyle(Color(hex: "2D8C82"))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "C8E9E4"), lineWidth: 1))
                }
            }
            .padding(20)
        }
        .background(Color(hex: "F7FAFC"))
    }
}

// MARK: - Menu Row
struct MenuRow: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Color(hex: "2D8C82"))
                    .frame(width: 34, height: 34)
                    .background(Color(hex: "EAF7F4"))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: "101828"))

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color(hex: "98A2B3"))
            }
            .padding(14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
    }
}
