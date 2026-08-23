import Foundation
import Speech

struct ModelStatusPayload: Encodable {
    let locale: String
    let state: String
    let reservedLocales: [String]
    let maximumReservedLocales: Int
}

struct ModelProgressPayload: Encodable {
    let locale: String
    let phase: String
    let fractionCompleted: Double?
}

enum ModelAssetService {
    static func status(localeIdentifier: String) async -> ModelStatusPayload {
        guard let locale = await SpeechTranscriber.supportedLocale(
            equivalentTo: Locale(identifier: localeIdentifier)
        ) else {
            return await payload(localeIdentifier, state: "unsupported")
        }
        let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
        let status = await AssetInventory.status(forModules: [transcriber])
        return await payload(locale.identifier, state: stateName(status))
    }

    static func install(localeIdentifier: String, writer: JSONLineWriter) async throws {
        guard let locale = await SpeechTranscriber.supportedLocale(
            equivalentTo: Locale(identifier: localeIdentifier)
        ) else {
            throw HelperCommandError.unsupportedLocale
        }
        let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
        if await AssetInventory.status(forModules: [transcriber]) == .installed {
            writer.write(
                type: "model-progress",
                payload: ModelProgressPayload(
                    locale: locale.identifier,
                    phase: "installed",
                    fractionCompleted: 1
                )
            )
            return
        }
        guard let request = try await AssetInventory.assetInstallationRequest(
            supporting: [transcriber]
        ) else {
            writer.write(
                type: "model-progress",
                payload: ModelProgressPayload(
                    locale: locale.identifier,
                    phase: "installed",
                    fractionCompleted: 1
                )
            )
            return
        }

        writer.write(
            type: "model-progress",
            payload: ModelProgressPayload(
                locale: locale.identifier,
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
                        payload: ModelProgressPayload(
                            locale: locale.identifier,
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
            payload: ModelProgressPayload(
                locale: locale.identifier,
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

    private static func payload(_ locale: String, state: String) async -> ModelStatusPayload {
        ModelStatusPayload(
            locale: locale,
            state: state,
            reservedLocales: await AssetInventory.reservedLocales.map(\.identifier).sorted(),
            maximumReservedLocales: AssetInventory.maximumReservedLocales
        )
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
