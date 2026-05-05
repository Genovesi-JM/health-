import SwiftUI

// MARK: - Patient Profile View
struct PatientProfileView: View {
    @StateObject private var auth = AuthService.shared
    @State private var dob = ""
    @State private var gender = ""
    @State private var bloodType = ""
    @State private var allergies = ""
    @State private var chronic = ""
    @State private var emergName = ""
    @State private var emergPhone = ""
    @State private var isSaving = false
    @State private var msg = ""
    @State private var msgOk = true
    @State private var medications: [MedicationItem] = []
    @State private var showMedForm = false
    @State private var newMedName = ""
    @State private var newMedDosage = ""
    @State private var newMedFreq = ""
    @State private var savingMed = false
    @State private var medsError = ""

    private let bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    private let genders = [("male", "Masculino"), ("female", "Feminino"), ("other", "Outro"), ("prefer_not_to_say", "Prefiro não dizer")]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                // Profile card
                profileCard.padding(.horizontal, 20)

                // Medications card
                medicationsCard.padding(.horizontal, 20)

                Spacer(minLength: 40)
            }
            .padding(.top, 20)
        }
        .background(Color(hex: "F5F7FA").ignoresSafeArea())
        .navigationTitle("Meu Perfil")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfile() }
    }

    // MARK: Profile Card
    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            // Section: Blood Type
            fieldLabel("Tipo Sanguíneo", icon: "drop.fill", color: "EF4444")
            Menu {
                Button("Selecionar") { bloodType = "" }
                ForEach(bloodTypes, id: \.self) { bt in Button(bt) { bloodType = bt } }
            } label: {
                HStack {
                    Text(bloodType.isEmpty ? "Selecionar" : bloodType)
                        .font(.system(size: 14)).foregroundStyle(bloodType.isEmpty ? Color(hex: "9CA3AF") : Color(hex: "101828"))
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 12)).foregroundStyle(Color(hex: "667085"))
                }
                .padding(12).background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
            }

            // Allergies
            fieldLabel("Alergias (separadas por vírgula)", icon: "allergens", color: "F59E0B")
            formTextField("Ex: Penicilina, Glúten", text: $allergies)

            // Chronic
            fieldLabel("Condições Crónicas (separadas por vírgula)", icon: "heart.text.square.fill", color: "2D8C82")
            formTextField("Ex: Diabetes, Hipertensão", text: $chronic)

            // Emergency contacts
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("Contacto de Emergência — Nome", icon: "person.fill", color: "6366F1")
                    formTextField("Nome do contacto", text: $emergName)
                }
                VStack(alignment: .leading, spacing: 6) {
                    fieldLabel("— Telefone", icon: "phone.fill", color: "22C55E")
                    formTextField("+244 ...", text: $emergPhone)
                        .keyboardType(.phonePad)
                }
            }

            // Message
            if !msg.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: msgOk ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                        .foregroundStyle(msgOk ? Color(hex: "22C55E") : .red)
                    Text(msg).font(.system(size: 13))
                        .foregroundStyle(msgOk ? Color(hex: "22C55E") : .red)
                }
            }

            // Save button
            Button {
                Task { await saveProfile() }
            } label: {
                HStack(spacing: 8) {
                    if isSaving {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "square.and.arrow.down.fill").foregroundStyle(.white)
                        Text("Guardar Perfil").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                    }
                }
                .frame(maxWidth: .infinity).frame(height: 48)
                .background(Color(hex: "2D8C82"))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(isSaving)
        }
        .padding(20).background(.white).clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }

    // MARK: Medications Card
    private var medicationsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "pills.fill").foregroundStyle(Color(hex: "7C3AED"))
                    Text("Medicações Actuais").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(hex: "101828"))
                }
                Spacer()
                Button {
                    showMedForm.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                        Text("Adicionar Medicação").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(Color(hex: "2D8C82"))
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(hex: "2D8C82"), lineWidth: 1.2))
                }
            }

            if !medsError.isEmpty {
                Text(medsError).font(.system(size: 12)).foregroundStyle(.red)
            }

            // Add form
            if showMedForm {
                VStack(spacing: 10) {
                    formTextField("Nome do medicamento *", text: $newMedName)
                    HStack(spacing: 10) {
                        formTextField("Dosagem (ex: 500mg)", text: $newMedDosage)
                        formTextField("Frequência (ex: 2x/dia)", text: $newMedFreq)
                    }
                    HStack(spacing: 10) {
                        Button { showMedForm = false } label: {
                            Text("Cancelar").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "667085"))
                                .frame(maxWidth: .infinity).padding(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
                        }
                        Button {
                            Task { await addMedication() }
                        } label: {
                            HStack {
                                if savingMed { ProgressView().tint(.white).scaleEffect(0.7) }
                                else { Text("Guardar").font(.system(size: 13, weight: .bold)).foregroundStyle(.white) }
                            }
                            .frame(maxWidth: .infinity).padding(10)
                            .background(Color(hex: "2D8C82")).clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .disabled(newMedName.isEmpty || savingMed)
                    }
                }
                .padding(14).background(Color(hex: "F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "E5E7EB"), lineWidth: 1))
            }

            if medications.isEmpty && !showMedForm {
                VStack(spacing: 8) {
                    Image(systemName: "pills").font(.system(size: 32)).foregroundStyle(Color(hex: "D1D5DB"))
                    Text("Nenhuma medicação registada.").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "374151"))
                    Text("Adicione as suas medicações para que apareçam no autocuidado e triagem.")
                        .font(.system(size: 12)).foregroundStyle(Color(hex: "9CA3AF")).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 20)
            } else {
                VStack(spacing: 10) {
                    ForEach(medications) { med in MedicationRow(med: med) }
                }
            }
        }
        .padding(20).background(.white).clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }

    // MARK: Helpers
    private func fieldLabel(_ text: String, icon: String? = nil, color: String = "667085") -> some View {
        HStack(spacing: 5) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 11)).foregroundStyle(Color(hex: color))
            }
            Text(text).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: "344054"))
        }
    }

    private func formTextField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .font(.system(size: 14))
            .padding(12)
            .background(Color(hex: "F9FAFB"))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(hex: "D1D5DB"), lineWidth: 1))
    }

    // MARK: Load / Save
    private func loadProfile() async {
        await auth.loadProfile()
        if let p = auth.profile {
            dob = p.date_of_birth ?? ""
            gender = p.gender ?? ""
            bloodType = p.blood_type ?? ""
            allergies = (p.allergies ?? []).joined(separator: ", ")
            chronic = (p.chronic_conditions ?? []).joined(separator: ", ")
            emergName = p.emergency_contact_name ?? ""
            emergPhone = p.emergency_contact_phone ?? ""
        }
        await loadMeds()
    }

    private func saveProfile() async {
        guard let t = auth.token else { return }
        isSaving = true; msg = ""
        let allergyList = allergies.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        let chronicList = chronic.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        var body: [String: Any] = [
            "blood_type": bloodType, "allergies": allergyList,
            "chronic_conditions": chronicList,
            "emergency_contact_name": emergName,
            "emergency_contact_phone": emergPhone,
        ]
        if !dob.isEmpty { body["date_of_birth"] = dob }
        if !gender.isEmpty { body["gender"] = gender }
        let req = API.request("/api/v1/patients/me", method: "PATCH", token: t, body: body)
        if let (_, resp) = try? await URLSession.shared.data(for: req),
           (resp as? HTTPURLResponse)?.statusCode ?? 0 < 300 {
            msg = "Perfil actualizado com sucesso."; msgOk = true
            await auth.loadProfile()
        } else {
            msg = "Erro ao guardar. Tente novamente."; msgOk = false
        }
        isSaving = false
    }

    private func loadMeds() async {
        guard let t = auth.token else { return }
        if let (data, _) = try? await URLSession.shared.data(for: API.request("/api/v1/medications/", token: t)),
           let list = try? JSONDecoder().decode([MedicationItem].self, from: data) {
            medications = list
        } else {
            medsError = "Não foi possível carregar os medicamentos."
        }
    }

    private func addMedication() async {
        guard let t = auth.token else { return }
        savingMed = true
        var body: [String: Any] = ["medication_name": newMedName]
        if !newMedDosage.isEmpty { body["dosage"] = newMedDosage }
        if !newMedFreq.isEmpty { body["frequency"] = newMedFreq }
        let req = API.request("/api/v1/medications/", method: "POST", token: t, body: body)
        if let (_, resp) = try? await URLSession.shared.data(for: req),
           (resp as? HTTPURLResponse)?.statusCode ?? 0 < 300 {
            newMedName = ""; newMedDosage = ""; newMedFreq = ""
            showMedForm = false
            await loadMeds()
        }
        savingMed = false
    }
}

// MARK: - Medication Row
struct MedicationRow: View {
    let med: MedicationItem
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "pills.fill").foregroundStyle(Color(hex: "7C3AED")).font(.system(size: 16))
                .frame(width: 36, height: 36)
                .background(Color(hex: "EDE9FE")).clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(med.medication_name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Color(hex: "101828"))
                if let d = med.dosage, let f = med.frequency {
                    Text("\(d) · \(f)").font(.system(size: 12)).foregroundStyle(Color(hex: "667085"))
                }
            }
            Spacer()
        }
        .padding(12).background(Color(hex: "F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
