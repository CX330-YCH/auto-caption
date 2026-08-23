import Foundation
import Speech

struct CapabilityPayload: Encodable {
    let isAvailable: Bool
    let supportedLocales: [String]
    let installedLocales: [String]
    let reservedLocales: [String]
    let maximumReservedLocales: Int
}

enum CapabilityProbe {
    static func run() async -> CapabilityPayload {
        async let supported = SpeechTranscriber.supportedLocales
        async let installed = SpeechTranscriber.installedLocales
        async let reserved = AssetInventory.reservedLocales
        return await CapabilityPayload(
            isAvailable: SpeechTranscriber.isAvailable,
            supportedLocales: supported.map(\.identifier).sorted(),
            installedLocales: installed.map(\.identifier).sorted(),
            reservedLocales: reserved.map(\.identifier).sorted(),
            maximumReservedLocales: AssetInventory.maximumReservedLocales
        )
    }
}
