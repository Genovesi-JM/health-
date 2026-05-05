import SwiftUI

// MARK: - Família View
struct PatientFamiliaView: View {
    @StateObject private var auth = AuthService.shared
    @State private var members: [FamilyMember] = []
    @State private var isLoading = true
    @State private var errorMsg = ""
    @State private var showAddForm = false
    @State private var newName = ""
    @State private var newDob = ""
    @State private var newRel = "son"
    @State private var isSaving = false

    private let relationships = [
        ("son", "Filho"), ("daughter", "Filha"), ("mother", "Mãe"), ("father", "Pai"),
        ("brother", "Irmão"), ("sister", "Irmã"), ("grandfather", "Avô"), ("grandmother", "Avó"),
        ("spouse", "Cônjuge"), ("other", "Outro"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {
                    pageHeader.padding(.horizontal, 20)
                    mainCard.padding(.horizontal, 20)
                    infoBox.padding(.horizontal, 20)
                    Spacer(minLength: 40)
                }
                .padding(.vertical, 20)
            }
            .background(Color(hex: "F5F7FA").ignoresSafeArea())
            .navigationTitle("Família")
            .navigationBarTitleDisplayMode(.large)
            .task { await load() }
        }
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Perfis Familiares").font(.system(size: 22, weight: .heavy)).foregroundStyle(Color(hex: "101828"))
            Text("Perfis de membros da família ou dependentes ligados à sua conta. Estes perfis não implicam cobertura médica automática.")
                .font(.system(size: 13)).foregroundStyle(Color(hex: "667085")).lineSpacing(2)
        }
    }

    private var mainCard: some View {
        VStack(spacing: 0) {
            // Header row
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "person.2.fill").foregroundStyle(Color(hex: "2D8C82"))
                    Text("Perfis Familiares").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(members.count) membro\(members.count == 1 ? "" : "s") registado\(members.count == 1 ? "" : "s")")
                        .font(.system(size: 12)).foregroundStyle(Color(hex: "667085"))
                }
                Spacer()
                Button {
                    withAnimation { showAddForm.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                        Text("Adicionar Familiar").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(Color(hex: "2D8C82"))
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "2D8C82"), lineWidth: 1.2))
                }
            }
            .padding(16)

            Divider()

            // Error
            if !errorMsg.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle").foregroundStyle(.red)
                    Text(errorMsg).font(.system(size: 13)).foregroundStyle(.red)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: "FEF2F2"))
            }

            // Add form
            if showAddForm {
                addForm.padding(16)
                Divider()
            }

            // Members
            if isLoading {
                ProgressView().padding(.vertical, 40).frame(maxWidth: .infinity)
            } else if members.isEmpty {
                emptyState
            } else {
                VStack(spacing: 0) {
                    ForEach(members) { m in
                        FamilyMemberRow(member: m)
                        if m.id != members.last?.id { Divider().padding(.horizontal, 16) }
                    }
                }
            }
        }
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.2.fill").font(.system(size: 44)).foregroundStyle(Color(hex: "D1D5DB"))
            Text("Nenhum perfil familiar registado.").font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "374151"))
            Text("Adicione um membro da família ou dependente para poder realizar triagens em nome deles e acompanhar a sua saúde.")
                .font(.system(size: 13)).foregroundStyle(Color(hex: "667085")).multilineTextAlignment(.center)
            Button {
                withAnimation { showAddForm = true }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold))
                    Text("Adicionar Familiar").font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 24).padding(.vertical, 12)
                .background(Color(hex: "2D8C82"))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
    }

    private var addForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Novo Familiar").font(.system(size: 14, weight: .bold)).foregroundStyle(Color(hex: "101828"))

            TextField("Nome completo *", text: $newName)
                .padding(10).background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "D1D5DB"), lineWidth: 1))

            HStack(spacing: 10) {
                TextField("Data nascimento (AAAA-MM-DD)", text: $newDob)
                    .font(.system(size: 13)).padding(10).background(Color(hex: "F9FAFB"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "D1D5DB"), lineWidth: 1))

                Menu {
                    ForEach(relationships, id: \.0) { key, label in
                        Button(label) { newRel = key }
                    }
                } label: {
                    HStack {
                        Text(relationships.first { $0.0 == newRel }?.1 ?? "Relação")
                            .font(.system(size: 13)).foregroundStyle(Color(hex: "101828"))
                        Spacer()
                        Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(Color(hex: "667085"))
                    }
                    .padding(10).background(Color(hex: "F9FAFB"))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                }
                .frame(width: 130)
            }

            HStack(spacing: 10) {
                Button { withAnimation { showAddForm = false } } label: {
                    Text("Cancelar").font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color(hex: "667085")).frame(maxWidth: .infinity).padding(10)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                }
                Button {
                    Task { await addMember() }
                } label: {
                    HStack {
                        if isSaving { ProgressView().tint(.white).scaleEffect(0.7) }
                        else { Text("Guardar").font(.system(size: 13, weight: .bold)).foregroundStyle(.white) }
                    }
                    .frame(maxWidth: .infinity).padding(10)
                    .background(Color(hex: "2D8C82")).clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(newName.isEmpty || isSaving)
            }
        }
    }

    private var infoBox: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill").foregroundStyle(Color(hex: "3B82F6")).font(.system(size: 14))
            Text("Os perfis de membros da família são geridos por si e ligados à sua conta. Podem ser seleccionados ao iniciar uma triagem em nome de outra pessoa. Não implicam automaticamente responsabilidade médica ou cobertura de seguro.")
                .font(.system(size: 12)).foregroundStyle(Color(hex: "374151")).lineSpacing(2)
        }
        .padding(14)
        .background(Color(hex: "EFF6FF"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "BFDBFE"), lineWidth: 1))
    }

    private func load() async {
        isLoading = true; errorMsg = ""
        guard let t = auth.token else { isLoading = false; errorMsg = "Não autenticado."; return }
        if let (data, resp) = try? await URLSession.shared.data(for: API.request("/api/v1/family/", token: t)),
           (resp as? HTTPURLResponse)?.statusCode == 200,
           let list = try? JSONDecoder().decode([FamilyMember].self, from: data) {
            members = list
        } else {
            errorMsg = "Não foi possível carregar os membros da família."
        }
        isLoading = false
    }

    private func addMember() async {
        guard let t = auth.token else { return }
        isSaving = true
        var body: [String: Any] = ["full_name": newName, "relationship": newRel]
        if !newDob.isEmpty { body["date_of_birth"] = newDob }
        if let (_, resp) = try? await URLSession.shared.data(for: API.request("/api/v1/family/", method: "POST", token: t, body: body)),
           (resp as? HTTPURLResponse)?.statusCode ?? 0 < 300 {
            newName = ""; newDob = ""; newRel = "son"
            withAnimation { showAddForm = false }
            await load()
        }
        isSaving = false
    }
}

struct FamilyMemberRow: View {
    let member: FamilyMember
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color(hex: "2D8C82").opacity(0.12)).frame(width: 44, height: 44)
                Text(member.initials).font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "2D8C82"))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(member.full_name).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                HStack(spacing: 8) {
                    Text(member.relationshipLabel).font(.system(size: 12))
                        .foregroundStyle(Color(hex: "2D8C82"))
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Color(hex: "2D8C82").opacity(0.08)).clipShape(Capsule())
                    if let dob = member.date_of_birth {
                        Text(dob).font(.system(size: 12)).foregroundStyle(Color(hex: "9CA3AF"))
                    }
                }
            }
            Spacer()
            if member.is_minor == true {
                Image(systemName: "figure.child").font(.system(size: 14)).foregroundStyle(Color(hex: "F59E0B"))
            }
        }
        .padding(16)
    }
}
