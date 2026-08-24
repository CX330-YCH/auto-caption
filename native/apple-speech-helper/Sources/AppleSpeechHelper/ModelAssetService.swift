import Foundation
import Speech

struct ModelStatusPayload: Encodable {
    let locale: String
    let state: String
    let systemInstalled: Bool
    let reservedLocales: [String]
    let maximumReservedLocales: Int
}

struct ModelProgressPayload: Encodable {
    let locale: String
    let phase: String
    let fractionCompleted: Double?
    let systemInstalled: Bool
    let reservedLocales: [String]
    let maximumReservedLocales: Int
}

enum ModelAssetService {
    static func status(localeIdentifier: String) async -> ModelStatusPayload {
        guard let locale = await SpeechTranscriber.supportedLocale(
            equivalentTo: Locale(identifier: localeIdentifier)
        ) else {
            return await payload(localeIdentifier, state: "unsupported", systemInstalled: false)
        }
        let transcriber = SpeechTranscriber(
            locale: locale,
            preset: .timeIndexedProgressiveTranscription
        )
        let status = await AssetInventory.status(forModules: [transcriber])
        return await payload(
            locale.identifier,
            state: stateName(status),
            systemInstalled: await isSystemInstalled(locale)
        )
    }

    static func install(localeIdentifier: String, writer: JSONLineWriter) async throws {
        guard let locale = await SpeechTranscriber.supportedLocale(
            equivalentTo: Locale(identifier: localeIdentifier)
        ) else {
            throw HelperCommandError.unsupportedLocale
        }
        let transcriber = SpeechTranscriber(
            locale: locale,
            preset: .timeIndexedProgressiveTranscription
        )
        if await AssetInventory.status(forModules: [transcriber]) == .installed {
            writer.write(
                type: "model-progress",
                payload: await progressPayload(locale, phase: "installed", fractionCompleted: 1)
            )
            return
        }
        guard let request = try await AssetInventory.assetInstallationRequest(
            supporting: [transcriber]
        ) else {
            writer.write(
                type: "model-progress",
                payload: await progressPayload(locale, phase: "installed", fractionCompleted: 1)
            )
            return
        }

        writer.write(
            type: "model-progress",
            payload: await progressPayload(
                locale,
                phase: "downloading",
                fractionCompleted: request.progress.fractionCompleted
            )
        )
        let progressTask = Task {
            var previous = -1
            while !Task.isCancelled {
                let percent = Int(request.progress.fractionCompleted * 100)
                if percent != previous {
                    previous = percent
                    writer.write(
                        type: "model-progress",
                        payload: await progressPayload(
                            locale,
                            phase: "downloading",
                            fractionCompleted: request.progress.fractionCompleted
                        )
                    )
                }
                try? await Task.sleep(for: .milliseconds(250))
            }
        }
        defer { progressTask.cancel() }
        try await request.downloadAndInstall()
        let verified = await AssetInventory.status(forModules: [transcriber])
        writer.write(
            type: "model-progress",
            payload: await progressPayload(
                locale,
                phase: verified == .installed ? "installed" : "failed",
                fractionCompleted: verified == .installed ? 1 : nil
            )
        )
    }

    static func release(localeIdentifier: String) async -> ModelStatusPayload {
        let locale = Locale(identifier: localeIdentifier)
        _ = await AssetInventory.release(reservedLocale: locale)
        return await status(localeIdentifier: localeIdentifier)
    }

    private static func payload(
        _ locale: String,
        state: String,
        systemInstalled: Bool
    ) async -> ModelStatusPayload {
        ModelStatusPayload(
            locale: locale,
            state: state,
            systemInstalled: systemInstalled,
            reservedLocales: await AssetInventory.reservedLocales.map(\.identifier).sorted(),
            maximumReservedLocales: AssetInventory.maximumReservedLocales
        )
    }

    private static func progressPayload(
        _ locale: Locale,
        phase: String,
        fractionCompleted: Double?
    ) async -> ModelProgressPayload {
        ModelProgressPayload(
            locale: locale.identifier,
            phase: phase,
            fractionCompleted: fractionCompleted,
            systemInstalled: await isSystemInstalled(locale),
            reservedLocales: await AssetInventory.reservedLocales.map(\.identifier).sorted(),
            maximumReservedLocales: AssetInventory.maximumReservedLocales
        )
    }

    private static func isSystemInstalled(_ locale: Locale) async -> Bool {
        await SpeechTranscriber.installedLocales.contains {
            $0.identifier == locale.identifier
        }
    }

    private static func stateName(_ status: AssetInventory.Status) -> String {
        switch status {
        case .unsupported: "unsupported"
        case .downloading: "downloading"
        case .supported: "supported"
        case .installed: "installed"
        @unknown default: "failed"
        }
    }
}
