import SwiftUI

// MARK: - Reusable Components

// Quick Action Card (2-column grid)
struct QuickActionCard: View {
    let title: String
    let icon: String
    let color: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color(hex: color))
                    .frame(width: 42, height: 42)
                    .background(Color(hex: color).opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color(hex: "101828"))

                HStack {
                    Text("Abrir")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(hex: "667085"))
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(hex: color))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 8)
        }
    }
}

// Service Row (icon + title + description)
struct ServiceRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(hex: "2D8C82"))
                .frame(width: 44, height: 44)
                .background(Color(hex: "EAF7F4"))
                .clipShape(RoundedRectangle(cornerRadius: 15))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: "101828"))
                Text(description)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color(hex: "5D6B82"))
                    .lineSpacing(2)
            }
            Spacer()
        }
        .padding(15)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.black.opacity(0.045), radius: 12, x: 0, y: 8)
    }
}

// Step Row (numbered step)
struct StepRow: View {
    let number: String
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            Text(number)
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Color(hex: "2D8C82"))
                .clipShape(Circle())

            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color(hex: "101828"))

            Spacer()
        }
    }
}
